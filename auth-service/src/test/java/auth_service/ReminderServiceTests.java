package auth_service;

import auth_service.config.JwtUtils;
import auth_service.controller.AuthController;
import auth_service.controller.ReminderController;
import auth_service.model.Reminder;
import auth_service.model.User;
import auth_service.repository.DeletedAccountRepository;
import auth_service.repository.ReminderRepository;
import auth_service.repository.TaskRepository;
import auth_service.repository.UserRepository;
import auth_service.service.GoogleTokenVerifier;
import auth_service.service.GeminiAiService;
import auth_service.service.ReminderSchedulerService;
import auth_service.service.ResendEmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest
public class ReminderServiceTests {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private DeletedAccountRepository deletedAccountRepository;

    @Autowired
    private ReminderRepository reminderRepository;

    @Autowired
    private JwtUtils jwtUtils;

    private User userA;
    private User userB;
    private String tokenA;
    private String tokenB;

    @BeforeEach
    void setUp() {
        reminderRepository.deleteAll();
        taskRepository.deleteAll();
        deletedAccountRepository.deleteAll();
        userRepository.findByEmail("usera_reminder@example.com").ifPresent(userRepository::delete);
        userRepository.findByEmail("userb_reminder@example.com").ifPresent(userRepository::delete);

        userA = new User();
        userA.setEmail("usera_reminder@example.com");
        userA.setName("Student Alice");
        userA.setTimezone("UTC");
        userA = userRepository.save(userA);
        tokenA = jwtUtils.generateToken(userA.getId(), userA.getEmail());

        userB = new User();
        userB.setEmail("userb_reminder@example.com");
        userB.setName("Student Bob");
        userB.setTimezone("UTC");
        userB = userRepository.save(userB);
        tokenB = jwtUtils.generateToken(userB.getId(), userB.getEmail());
    }

    @Test
    void testCreateReminderAndPersistence() {
        ResendEmailService mockEmail = mock(ResendEmailService.class);
        ReminderController controller = new ReminderController(reminderRepository, userRepository, mockEmail, jwtUtils);

        Instant due = Instant.now().plus(2, ChronoUnit.HOURS);
        Map<String, Object> payload = Map.of(
                "title", "Study for Operating Systems Midterm",
                "dueAt", due.toString(),
                "method", "Email",
                "notificationTiming", "1h",
                "targetType", "exam"
        );

        ResponseEntity<?> response = controller.createOrUpdateReminder(
                String.valueOf(userA.getId()),
                "Bearer " + tokenA,
                payload
        );

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        Reminder created = (Reminder) response.getBody();
        assertNotNull(created);
        assertNotNull(created.getId());
        assertEquals("Study for Operating Systems Midterm", created.getTitle());
        assertEquals("PENDING", created.getDeliveryStatus());
        assertEquals(userA.getId(), created.getUserId());

        // Verify in DB
        List<Reminder> inDb = reminderRepository.findByUserIdOrderByDueAtAsc(userA.getId());
        assertEquals(1, inDb.size());
        assertEquals("Study for Operating Systems Midterm", inDb.get(0).getTitle());
    }

    @Test
    void testContestReminderDeduplication() {
        ResendEmailService mockEmail = mock(ResendEmailService.class);
        ReminderController controller = new ReminderController(reminderRepository, userRepository, mockEmail, jwtUtils);

        Map<String, Object> payload1 = Map.of(
                "title", "Codeforces Round 999",
                "dueAt", Instant.now().plus(1, ChronoUnit.DAYS).toString(),
                "targetType", "contest",
                "contestId", "cf-999",
                "platform", "Codeforces",
                "contestUrl", "https://codeforces.com/contest/999",
                "notificationTiming", "30m"
        );

        controller.createOrUpdateReminder(String.valueOf(userA.getId()), null, payload1);
        assertEquals(1, reminderRepository.findByUserIdOrderByDueAtAsc(userA.getId()).size());

        // Click again with updated notification timing (e.g. 1h instead of 30m)
        Map<String, Object> payload2 = Map.of(
                "title", "Codeforces Round 999",
                "dueAt", Instant.now().plus(1, ChronoUnit.DAYS).toString(),
                "targetType", "contest",
                "contestId", "cf-999",
                "platform", "Codeforces",
                "contestUrl", "https://codeforces.com/contest/999",
                "notificationTiming", "1h"
        );

        controller.createOrUpdateReminder(String.valueOf(userA.getId()), null, payload2);

        // Ensure NOT duplicated
        List<Reminder> list = reminderRepository.findByUserIdOrderByDueAtAsc(userA.getId());
        assertEquals(1, list.size(), "Contest reminders must be deduplicated by contestId");
        assertEquals("1h", list.get(0).getNotificationTiming());
    }

    @Test
    void testUserDataIsolationBetweenUsers() {
        ResendEmailService mockEmail = mock(ResendEmailService.class);
        ReminderController controller = new ReminderController(reminderRepository, userRepository, mockEmail, jwtUtils);

        // User A creates reminder
        Reminder remA = new Reminder();
        remA.setUserId(userA.getId());
        remA.setTitle("User A Private Reminder");
        remA.setDueAt(Instant.now().plus(1, ChronoUnit.HOURS));
        remA = reminderRepository.save(remA);

        // User B queries reminders
        ResponseEntity<?> bListResp = controller.getReminders(String.valueOf(userB.getId()), null);
        @SuppressWarnings("unchecked")
        List<Reminder> bList = (List<Reminder>) bListResp.getBody();
        assertNotNull(bList);
        assertEquals(0, bList.size(), "User B must not see User A's reminders");

        // User B attempts to delete User A's reminder -> 404 NOT FOUND
        ResponseEntity<?> deleteResp = controller.deleteReminder(remA.getId(), String.valueOf(userB.getId()), null);
        assertEquals(HttpStatus.NOT_FOUND, deleteResp.getStatusCode());

        // User A's reminder remains intact
        assertTrue(reminderRepository.findById(remA.getId()).isPresent());
    }

    @Test
    void testAccountDeletionCascadesToReminders() {
        // Create reminder for User A
        Reminder rem = new Reminder();
        rem.setUserId(userA.getId());
        rem.setTitle("Reminder to be deleted");
        rem.setDueAt(Instant.now().plus(1, ChronoUnit.HOURS));
        reminderRepository.save(rem);

        GoogleTokenVerifier mockVerifier = mock(GoogleTokenVerifier.class);
        GeminiAiService mockAi = mock(GeminiAiService.class);
        AuthController authController = new AuthController(userRepository, taskRepository, deletedAccountRepository,
                reminderRepository, mockVerifier, mockAi, jwtUtils);

        // Delete User A account
        ResponseEntity<?> resp = authController.deleteAccount(String.valueOf(userA.getId()), null, null);
        assertEquals(HttpStatus.OK, resp.getStatusCode());

        // Verify reminder is cascade deleted
        List<Reminder> remaining = reminderRepository.findByUserIdOrderByDueAtAsc(userA.getId());
        assertTrue(remaining.isEmpty(), "Account deletion must purge all student reminders");
    }

    @Test
    void testScheduledWorkerDispatchesDueRemindersAndUpdatesDeliveryStatus() {
        // Create a due reminder for User A
        Reminder rem = new Reminder();
        rem.setUserId(userA.getId());
        rem.setTitle("Urgent Contest Lead Alert");
        rem.setDueAt(Instant.now().minus(2, ChronoUnit.MINUTES)); // due 2 min ago
        rem.setTargetType("contest");
        rem.setMethod("Email");
        rem.setDeliveryStatus("PENDING");
        rem = reminderRepository.save(rem);

        ResendEmailService mockEmail = mock(ResendEmailService.class);
        when(mockEmail.buildReminderEmailHtml(any(), any(), any(), any(), any())).thenReturn("<p>Reminder</p>");
        when(mockEmail.sendEmail(eq("usera_reminder@example.com"), anyString(), anyString()))
                .thenReturn(new ResendEmailService.EmailDeliveryResult(true, "resend-msg-12345", null));

        ReminderSchedulerService scheduler = new ReminderSchedulerService(reminderRepository, userRepository, mockEmail, true);

        // Run worker
        scheduler.processDueReminders();

        // Check updated status in DB
        Reminder updated = reminderRepository.findById(rem.getId()).orElseThrow();
        assertEquals("DELIVERED", updated.getDeliveryStatus());
        assertNotNull(updated.getNotifiedAt());
        assertNull(updated.getDeliveryError());
        assertEquals(1, updated.getDeliveryAttempts());

        // Second run must NOT duplicate email send
        scheduler.processDueReminders();
        verify(mockEmail, times(1)).sendEmail(anyString(), anyString(), anyString());
    }

    @Test
    void testScheduledWorkerRecordsFailureWhenProviderFails() {
        Reminder rem = new Reminder();
        rem.setUserId(userA.getId());
        rem.setTitle("Lab Check-in");
        rem.setDueAt(Instant.now().minus(1, ChronoUnit.MINUTES));
        rem.setTargetType("task");
        rem.setMethod("Email");
        rem.setDeliveryStatus("PENDING");
        rem = reminderRepository.save(rem);

        ResendEmailService mockEmail = mock(ResendEmailService.class);
        when(mockEmail.buildReminderEmailHtml(any(), any(), any(), any(), any())).thenReturn("<p>Content</p>");
        when(mockEmail.sendEmail(anyString(), anyString(), anyString()))
                .thenReturn(new ResendEmailService.EmailDeliveryResult(false, null, "Resend 422: Unverified sender domain"));

        ReminderSchedulerService scheduler = new ReminderSchedulerService(reminderRepository, userRepository, mockEmail, true);

        scheduler.processDueReminders();

        Reminder updated = reminderRepository.findById(rem.getId()).orElseThrow();
        assertEquals("FAILED", updated.getDeliveryStatus());
        assertNotNull(updated.getDeliveryError());
        assertTrue(updated.getDeliveryError().contains("Unverified sender domain"));
        assertEquals(1, updated.getDeliveryAttempts());
    }

    @Test
    void testSingleVerifiedRecipientTestEmailEndpoint() {
        ResendEmailService mockEmail = mock(ResendEmailService.class);
        when(mockEmail.isConfigured()).thenReturn(true);
        when(mockEmail.buildReminderEmailHtml(any(), any(), any(), any(), any())).thenReturn("<html>Test</html>");
        when(mockEmail.sendEmail(eq("usera_reminder@example.com"), anyString(), anyString()))
                .thenReturn(new ResendEmailService.EmailDeliveryResult(true, "resend-test-999", null));

        ReminderController controller = new ReminderController(reminderRepository, userRepository, mockEmail, jwtUtils);

        ResponseEntity<?> response = controller.sendTestReminderEmail(
                String.valueOf(userA.getId()),
                null,
                Map.of("title", "Verified Single Recipient Test")
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("success"));
        assertEquals("usera_reminder@example.com", body.get("recipient"));
        assertEquals("resend-test-999", body.get("messageId"));
    }

    @Test
    void testBrevoTransactionalEmailDelegationInResendEmailService() {
        auth_service.service.BrevoEmailService mockBrevo = mock(auth_service.service.BrevoEmailService.class);
        when(mockBrevo.isConfigured()).thenReturn(true);
        when(mockBrevo.getSenderName()).thenReturn("SAGE");
        when(mockBrevo.getSenderEmail()).thenReturn("pokurilaharionedrive@gmail.com");
        when(mockBrevo.sendEmail(eq("usera_reminder@example.com"), anyString(), anyString()))
                .thenReturn(new auth_service.service.BrevoEmailService.EmailDeliveryResult(true, "<brevo-test-20261021@relay.brevo.com>", null));

        ResendEmailService emailService = new ResendEmailService(mockBrevo, "", "");
        assertTrue(emailService.isConfigured(), "Should be configured when Brevo is configured");
        assertEquals("Brevo", emailService.getActiveProviderName());
        assertEquals("SAGE <pokurilaharionedrive@gmail.com>", emailService.getFromAddress());

        ReminderController controller = new ReminderController(reminderRepository, userRepository, emailService, jwtUtils);
        ResponseEntity<?> response = controller.sendTestReminderEmail(
                String.valueOf(userA.getId()),
                null,
                Map.of("title", "Brevo Transactional Verification")
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("success"));
        assertEquals("<brevo-test-20261021@relay.brevo.com>", body.get("messageId"));
        assertEquals("Brevo", body.get("provider"));
        verify(mockBrevo, times(1)).sendEmail(eq("usera_reminder@example.com"), anyString(), anyString());
    }
}
