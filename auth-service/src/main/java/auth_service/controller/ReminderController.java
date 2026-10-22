package auth_service.controller;

import auth_service.config.JwtUtils;
import auth_service.model.Reminder;
import auth_service.model.User;
import auth_service.repository.ReminderRepository;
import auth_service.repository.UserRepository;
import auth_service.service.ResendEmailService;
import com.auth0.jwt.interfaces.DecodedJWT;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/reminders")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class ReminderController {

    private static final Logger log = LoggerFactory.getLogger(ReminderController.class);

    private final ReminderRepository reminderRepository;
    private final UserRepository userRepository;
    private final ResendEmailService resendEmailService;
    private final JwtUtils jwtUtils;

    public ReminderController(
            ReminderRepository reminderRepository,
            UserRepository userRepository,
            ResendEmailService resendEmailService,
            JwtUtils jwtUtils) {
        this.reminderRepository = reminderRepository;
        this.userRepository = userRepository;
        this.resendEmailService = resendEmailService;
        this.jwtUtils = jwtUtils;
    }

    private Long resolveUserId(String xUserId, String authHeader) {
        if (xUserId != null && !xUserId.trim().isEmpty()) {
            try {
                return Long.parseLong(xUserId.trim());
            } catch (NumberFormatException ignored) {}
        }
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            DecodedJWT jwt = jwtUtils.verifyToken(token);
            if (jwt != null) {
                try {
                    return Long.parseLong(jwt.getSubject());
                } catch (NumberFormatException ignored) {}
            }
        }
        return null;
    }

    @GetMapping
    public ResponseEntity<?> getReminders(
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Long userId = resolveUserId(xUserId, authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        List<Reminder> reminders = reminderRepository.findByUserIdOrderByDueAtAsc(userId);
        return ResponseEntity.ok(reminders);
    }

    @PostMapping
    public ResponseEntity<?> createOrUpdateReminder(
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> payload) {

        Long userId = resolveUserId(xUserId, authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        String title = payload.containsKey("title") && payload.get("title") != null
                ? payload.get("title").toString().trim()
                : "";
        if (title.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Title is required"));
        }

        String dueAtStr = payload.containsKey("dueAt") && payload.get("dueAt") != null
                ? payload.get("dueAt").toString()
                : null;
        Instant dueAt;
        try {
            dueAt = dueAtStr != null ? Instant.parse(dueAtStr) : Instant.now();
        } catch (Exception e) {
            dueAt = Instant.now();
        }

        String targetType = payload.getOrDefault("targetType", "reminder").toString();
        String contestId = payload.containsKey("contestId") && payload.get("contestId") != null
                ? payload.get("contestId").toString()
                : null;
        String targetId = payload.containsKey("targetId") && payload.get("targetId") != null
                ? payload.get("targetId").toString()
                : null;

        // Deduplication:
        // 1. By explicit ID if provided and belongs to user
        // 2. By contest ID if contest reminder
        // 3. By targetType + targetId if task/exam deadline
        Reminder reminder = null;
        if (payload.containsKey("id") && payload.get("id") != null) {
            try {
                Long rId = Long.parseLong(payload.get("id").toString());
                Optional<Reminder> opt = reminderRepository.findByIdAndUserId(rId, userId);
                if (opt.isPresent()) {
                    reminder = opt.get();
                }
            } catch (Exception ignored) {}
        }
        if (reminder == null && "contest".equalsIgnoreCase(targetType) && contestId != null) {
            List<Reminder> existing = reminderRepository.findByUserIdAndTargetTypeAndContestId(userId, targetType, contestId);
            if (!existing.isEmpty()) {
                reminder = existing.get(0);
            }
        }
        if (reminder == null && targetId != null && !targetId.isBlank()) {
            List<Reminder> existing = reminderRepository.findByUserIdAndTargetTypeAndTargetId(userId, targetType, targetId);
            if (!existing.isEmpty()) {
                reminder = existing.get(0);
            }
        }

        if (reminder == null) {
            reminder = new Reminder();
            reminder.setUserId(userId);
            reminder.setDeliveryStatus("PENDING");
            reminder.setDeliveryAttempts(0);
        } else {
            // If updating an active reminder whose due time changed, reset delivery status so it re-triggers
            if (!dueAt.equals(reminder.getDueAt())) {
                reminder.setDeliveryStatus("PENDING");
                reminder.setNotifiedAt(null);
            }
        }

        reminder.setTitle(title);
        reminder.setDueAt(dueAt);
        reminder.setStatus(payload.getOrDefault("status", "open").toString());
        reminder.setMethod(payload.getOrDefault("method", "Email + In-app").toString());
        reminder.setNotificationTiming(payload.getOrDefault("notificationTiming", "exact").toString());
        reminder.setTargetType(targetType);
        if (targetId != null) {
            reminder.setTargetId(targetId);
        }
        if (contestId != null) {
            reminder.setContestId(contestId);
        }
        if (payload.containsKey("platform") && payload.get("platform") != null) {
            reminder.setPlatform(payload.get("platform").toString());
        }
        if (payload.containsKey("contestUrl") && payload.get("contestUrl") != null) {
            reminder.setContestUrl(payload.get("contestUrl").toString());
        }
        if (payload.containsKey("eventStartTime") && payload.get("eventStartTime") != null) {
            reminder.setEventStartTime(payload.get("eventStartTime").toString());
        }
        if (payload.containsKey("recipientEmail") && payload.get("recipientEmail") != null) {
            String recEmail = payload.get("recipientEmail").toString().trim();
            if (!recEmail.isBlank() && recEmail.contains("@")) {
                reminder.setRecipientEmail(recEmail);
            }
        }
        if (reminder.getRecipientEmail() == null || reminder.getRecipientEmail().isBlank()) {
            Optional<User> uOpt = userRepository.findById(userId);
            if (uOpt.isPresent()) {
                User u = uOpt.get();
                String e = (u.getNotificationEmail() != null && !u.getNotificationEmail().isBlank())
                        ? u.getNotificationEmail()
                        : u.getEmail();
                reminder.setRecipientEmail(e);
            }
        }

        Reminder saved = reminderRepository.save(reminder);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> updateReminder(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> updates) {

        Long userId = resolveUserId(xUserId, authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        Optional<Reminder> optReminder = reminderRepository.findByIdAndUserId(id, userId);
        if (optReminder.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Reminder not found"));
        }

        Reminder reminder = optReminder.get();
        if (updates.containsKey("status") && updates.get("status") != null) {
            String newStatus = updates.get("status").toString();
            reminder.setStatus(newStatus);
            if ("completed".equalsIgnoreCase(newStatus)) {
                reminder.setCompletedAt(Instant.now());
            }
        }
        if (updates.containsKey("title") && updates.get("title") != null) {
            reminder.setTitle(updates.get("title").toString());
        }
        if (updates.containsKey("dueAt") && updates.get("dueAt") != null) {
            try {
                reminder.setDueAt(Instant.parse(updates.get("dueAt").toString()));
                // Reset delivery status if due date was rescheduled
                reminder.setDeliveryStatus("PENDING");
            } catch (Exception ignored) {}
        }
        if (updates.containsKey("snoozedUntil") && updates.get("snoozedUntil") != null) {
            try {
                Instant snoozedTime = Instant.parse(updates.get("snoozedUntil").toString());
                reminder.setSnoozedUntil(snoozedTime);
                reminder.setDueAt(snoozedTime);
                reminder.setStatus("snoozed");
                reminder.setDeliveryStatus("PENDING");
                reminder.setNotifiedAt(null);
            } catch (Exception ignored) {}
        }
        if (updates.containsKey("method") && updates.get("method") != null) {
            reminder.setMethod(updates.get("method").toString());
        }

        Reminder saved = reminderRepository.save(reminder);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteReminder(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Long userId = resolveUserId(xUserId, authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        Optional<Reminder> optReminder = reminderRepository.findByIdAndUserId(id, userId);
        if (optReminder.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Reminder not found"));
        }

        reminderRepository.delete(optReminder.get());
        return ResponseEntity.ok(Map.of("message", "Reminder deleted successfully", "id", id));
    }

    @PostMapping("/test-email")
    public ResponseEntity<?> sendTestReminderEmail(
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) Map<String, Object> body) {

        Long userId = resolveUserId(xUserId, authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        User user = userOpt.orElse(null);

        String toEmail = null;
        if (body != null && body.containsKey("email") && body.get("email") != null) {
            String passed = body.get("email").toString().trim();
            if (!passed.isBlank() && passed.contains("@")) {
                toEmail = passed;
            }
        }

        if (toEmail == null && user != null) {
            toEmail = (user.getNotificationEmail() != null && !user.getNotificationEmail().isBlank())
                    ? user.getNotificationEmail()
                    : user.getEmail();
        }

        if (toEmail == null || toEmail.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No recipient email address found for the logged-in user."));
        }

        String recipientName = (user != null && user.getName() != null && !user.getName().isBlank())
                ? user.getName()
                : toEmail.split("@")[0];

        String title = (body != null && body.containsKey("title") && body.get("title") != null)
                ? body.get("title").toString()
                : "Complete Lab Assignment & Submit Code";

        String html = resendEmailService.buildReminderEmailHtml(
                recipientName,
                title,
                "Academic",
                "Today at 18:00",
                null
        );

        ResendEmailService.EmailDeliveryResult result = resendEmailService.sendEmail(
                toEmail,
                "SAGE Test Reminder: " + title,
                html
        );

        String provider = resendEmailService.getActiveProviderName();
        Map<String, Object> response = new HashMap<>();
        response.put("success", result.success());
        response.put("recipient", toEmail);
        response.put("configured", resendEmailService.isConfigured());
        response.put("provider", provider);

        if (result.success()) {
            response.put("messageId", result.messageId());
            response.put("message", "Test reminder email delivered successfully via " + provider + ".");
            return ResponseEntity.ok(response);
        } else {
            response.put("error", result.errorMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
        }
    }
}
