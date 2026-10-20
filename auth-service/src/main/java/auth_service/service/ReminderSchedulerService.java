package auth_service.service;

import auth_service.model.Reminder;
import auth_service.model.User;
import auth_service.repository.ReminderRepository;
import auth_service.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ReminderSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(ReminderSchedulerService.class);

    private final ReminderRepository reminderRepository;
    private final UserRepository userRepository;
    private final ResendEmailService resendEmailService;
    private final boolean workerEnabled;

    public ReminderSchedulerService(
            ReminderRepository reminderRepository,
            UserRepository userRepository,
            ResendEmailService resendEmailService,
            @Value("${sage.email.worker.enabled:true}") boolean workerEnabled) {
        this.reminderRepository = reminderRepository;
        this.userRepository = userRepository;
        this.resendEmailService = resendEmailService;
        this.workerEnabled = workerEnabled;
    }

    @Scheduled(fixedDelayString = "${sage.email.worker.interval-ms:30000}", initialDelay = 10000)
    public void processDueReminders() {
        if (!workerEnabled) {
            return;
        }

        Instant now = Instant.now();
        List<Reminder> duePending = reminderRepository.findByStatusAndDeliveryStatusAndDueAtLessThanEqual("open", "PENDING", now);

        if (!duePending.isEmpty()) {
            log.info("Reminder worker: Found {} pending reminder(s) due at or before {}", duePending.size(), now);
        }

        for (Reminder reminder : duePending) {
            processSingleReminder(reminder, now);
        }
    }

    @Transactional
    public void processSingleReminder(Reminder reminder, Instant now) {
        // Guard against duplicate processing
        if ("DELIVERED".equalsIgnoreCase(reminder.getDeliveryStatus()) || reminder.getNotifiedAt() != null) {
            return;
        }

        // Method verification
        String method = reminder.getMethod() != null ? reminder.getMethod() : "Email";
        if (!method.toLowerCase().contains("email")) {
            reminder.setDeliveryStatus("SKIPPED");
            reminder.setDeliveryError("Method is in-app only, email dispatch skipped");
            reminderRepository.save(reminder);
            return;
        }

        Optional<User> userOpt = userRepository.findById(reminder.getUserId());
        if (userOpt.isEmpty()) {
            reminder.setDeliveryStatus("SKIPPED");
            reminder.setDeliveryError("Associated student account not found");
            reminderRepository.save(reminder);
            return;
        }

        User user = userOpt.get();
        String toEmail = (user.getNotificationEmail() != null && !user.getNotificationEmail().isBlank())
                ? user.getNotificationEmail()
                : user.getEmail();

        if (toEmail == null || toEmail.isBlank()) {
            reminder.setDeliveryStatus("SKIPPED");
            reminder.setDeliveryError("User has no registered notification email address");
            reminderRepository.save(reminder);
            return;
        }

        // Check quiet hours in user's timezone (skip quiet hours for contest, exam, and urgent deadlines)
        boolean isUrgentDeadline = "contest".equalsIgnoreCase(reminder.getTargetType())
                || "exam".equalsIgnoreCase(reminder.getTargetType())
                || "task".equalsIgnoreCase(reminder.getTargetType());

        if (!isUrgentDeadline && isInsideQuietHours(user, now)) {
            log.info("Quiet hours active for user {}, postponing non-urgent reminder id={}", user.getId(), reminder.getId());
            return;
        }

        // Attempt delivery
        int currentAttempts = reminder.getDeliveryAttempts();
        reminder.setDeliveryAttempts(currentAttempts + 1);

        String subject = "SAGE Reminder: " + reminder.getTitle();
        String htmlContent = resendEmailService.buildReminderEmailHtml(
                user.getName(),
                reminder.getTitle(),
                reminder.getTargetType(),
                reminder.getEventStartTime(),
                reminder.getContestUrl()
        );

        ResendEmailService.EmailDeliveryResult result = resendEmailService.sendEmail(toEmail, subject, htmlContent);

        if (result.success()) {
            reminder.setDeliveryStatus("DELIVERED");
            reminder.setNotifiedAt(Instant.now());
            reminder.setDeliveryError(null);
            log.info("Reminder id={} delivered to student id={} successfully (msgId={})",
                    reminder.getId(), user.getId(), result.messageId());
        } else {
            reminder.setDeliveryStatus("FAILED");
            String err = result.errorMessage();
            if (err != null && err.length() > 900) {
                err = err.substring(0, 900);
            }
            reminder.setDeliveryError(err);
            log.warn("Reminder id={} delivery attempt {} failed: {}",
                    reminder.getId(), reminder.getDeliveryAttempts(), err);
        }

        reminderRepository.save(reminder);
    }

    /**
     * Determines if current time is within student's local quiet hours.
     */
    public boolean isInsideQuietHours(User user, Instant now) {
        String tzStr = user.getTimezone();
        ZoneId zoneId;
        try {
            zoneId = (tzStr != null && !tzStr.isBlank()) ? ZoneId.of(tzStr) : ZoneId.of("UTC");
        } catch (Exception e) {
            zoneId = ZoneId.of("UTC");
        }

        ZonedDateTime localZdt = now.atZone(zoneId);
        LocalTime localTime = localZdt.toLocalTime();

        // Default quiet hours 22:00 to 07:00 (10:00 PM to 7:00 AM)
        LocalTime quietStart = LocalTime.of(22, 0);
        LocalTime quietEnd = LocalTime.of(7, 0);

        // Crosses midnight: true if time >= 22:00 OR time < 07:00
        return !localTime.isBefore(quietStart) || localTime.isBefore(quietEnd);
    }
}
