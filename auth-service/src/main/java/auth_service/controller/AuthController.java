package auth_service.controller;

import auth_service.model.DeletedAccount;
import auth_service.model.Task;
import auth_service.model.User;
import auth_service.repository.DeletedAccountRepository;
import auth_service.repository.TaskRepository;
import auth_service.repository.UserRepository;
import auth_service.config.JwtUtils;
import com.auth0.jwt.JWT;
import com.auth0.jwt.interfaces.DecodedJWT;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class AuthController {
    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final UserRepository userRepository;
    private final TaskRepository taskRepository;
    private final DeletedAccountRepository deletedAccountRepository;
    private final auth_service.repository.ReminderRepository reminderRepository;
    private final auth_service.service.GoogleTokenVerifier googleTokenVerifier;
    private final auth_service.service.GeminiAiService geminiAiService;
    private final JwtUtils jwtUtils;

    public AuthController(UserRepository userRepository, TaskRepository taskRepository,
                          DeletedAccountRepository deletedAccountRepository,
                          auth_service.repository.ReminderRepository reminderRepository,
                          auth_service.service.GoogleTokenVerifier googleTokenVerifier,
                          auth_service.service.GeminiAiService geminiAiService,
                          JwtUtils jwtUtils) {
        this.userRepository = userRepository;
        this.taskRepository = taskRepository;
        this.deletedAccountRepository = deletedAccountRepository;
        this.reminderRepository = reminderRepository;
        this.googleTokenVerifier = googleTokenVerifier;
        this.geminiAiService = geminiAiService;
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

    @DeleteMapping("/auth/account")
    @Transactional
    public ResponseEntity<?> deleteAccount(
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            HttpServletResponse response) {

        Long userId = resolveUserId(xUserId, authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
        }

        User user = userOpt.get();

        // 1. Delete all tasks belonging to this user
        List<Task> userTasks = taskRepository.findByUserIdOrderByCreatedAtDesc(userId);
        if (userTasks != null && !userTasks.isEmpty()) {
            taskRepository.deleteAll(userTasks);
        }

        // 2. Delete all reminders belonging to this user
        List<auth_service.model.Reminder> userReminders = reminderRepository.findByUserIdOrderByDueAtAsc(userId);
        if (userReminders != null && !userReminders.isEmpty()) {
            reminderRepository.deleteAll(userReminders);
        }

        // 2. Persist deletion tombstone to prevent automatic re-registration
        DeletedAccount tombstone = new DeletedAccount(
            user.getId(),
            user.getGoogleId(),
            user.getEmail(),
            "USER_REQUESTED"
        );
        deletedAccountRepository.save(tombstone);

        // 3. Delete the user
        userRepository.delete(user);

        // 4. Expire authentication cookie if present
        if (response != null) {
            Cookie cookie = new Cookie("sage_token", "");
            cookie.setPath("/");
            cookie.setMaxAge(0);
            cookie.setHttpOnly(true);
            response.addCookie(cookie);
        }

        return ResponseEntity.ok(Map.of(
            "message", "Account permanently deleted",
            "deleted", true
        ));
    }

    @PostMapping("/auth/google")
    public ResponseEntity<?> exchangeGoogleToken(@RequestBody(required = false) Map<String, Object> body) {
        if (body == null || !body.containsKey("credential") || body.get("credential") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Credential is required"));
        }
        String credential = body.get("credential").toString().trim();
        if (credential.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Credential must not be empty"));
        }

        auth_service.service.VerifiedGoogleUser verifiedUser;
        try {
            verifiedUser = googleTokenVerifier.verify(credential);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Malformed credential"));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid or expired Google credential"));
        } catch (Exception e) {
            log.error("event=google_auth_processing_failed requestId={}", requestId(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Authentication processing failed"));
        }

        try {
            String googleId = verifiedUser.sub();
            String email = verifiedUser.email();
            String name = verifiedUser.name();

            boolean isDeleted = (googleId != null && deletedAccountRepository.existsByGoogleId(googleId))
                || (email != null && deletedAccountRepository.existsByEmailIgnoreCase(email));
            if (isDeleted) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "This SAGE account was permanently deleted. Automatic recreation is disabled.",
                    "code", "ACCOUNT_DELETED"
                ));
            }

            User user = userRepository.findByGoogleId(googleId)
                .orElseGet(() -> {
                    Optional<User> existingEmailUser = userRepository.findByEmail(email);
                    if (existingEmailUser.isPresent()) {
                        User found = existingEmailUser.get();
                        found.setGoogleId(googleId);
                        if (name != null && !name.trim().isEmpty() && (found.getName() == null || found.getName().isEmpty())) {
                            found.setName(name);
                        }
                        found.setEmailVerified(true);
                        return userRepository.save(found);
                    }
                    User newUser = new User();
                    newUser.setGoogleId(googleId);
                    newUser.setEmail(email);
                    newUser.setName(name);
                    newUser.setAuthProvider("GOOGLE");
                    newUser.setEmailVerified(true);
                    newUser.setNotificationEmail(email);
                    newUser.setNotificationEmailVerified(true);
                    newUser.setOnboardingCompleted(false);
                    return userRepository.save(newUser);
                });

            if (name != null && !name.trim().isEmpty() && (user.getName() == null || user.getName().isEmpty())) {
                user.setName(name);
                user = userRepository.save(user);
            }

            String token = jwtUtils.generateToken(user.getId(), user.getEmail());

            Map<String, Object> userDto = new HashMap<>();
            userDto.put("id", user.getId());
            userDto.put("email", user.getEmail());
            userDto.put("name", user.getName() != null ? user.getName() : "");
            userDto.put("picture", verifiedUser.picture());
            userDto.put("onboardingCompleted", Boolean.TRUE.equals(user.isOnboardingCompleted()));

            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("user", userDto);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Authentication processing failed"));
        }
    }

    @GetMapping("/auth/me")
    public ResponseEntity<?> getCurrentUser(
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        
        Long userId = resolveUserId(xUserId, authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        return userRepository.findById(userId)
            .map(user -> {
                Map<String, Object> resp = new HashMap<>();
                resp.put("id", user.getId());
                resp.put("name", user.getName());
                resp.put("email", user.getEmail());
                resp.put("onboardingCompleted", user.isOnboardingCompleted());
                resp.put("college", user.getCollege());
                resp.put("course", user.getCourse());
                resp.put("year", user.getYear());
                resp.put("timezone", user.getTimezone());
                return ResponseEntity.ok(resp);
            })
            .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found")));
    }

    @PostMapping("/auth/onboarding")
    public ResponseEntity<?> completeOnboarding(
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body) {
        
        Long userId = resolveUserId(xUserId, authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        return userRepository.findById(userId)
            .map(user -> {
                if (body.containsKey("name") && body.get("name") != null) {
                    user.setName(body.get("name").toString());
                }
                if (body.containsKey("college") && body.get("college") != null) {
                    user.setCollege(body.get("college").toString());
                }
                if (body.containsKey("course") && body.get("course") != null) {
                    user.setCourse(body.get("course").toString());
                }
                if (body.containsKey("year") && body.get("year") != null) {
                    user.setYear(body.get("year").toString());
                }
                if (body.containsKey("timezone") && body.get("timezone") != null) {
                    user.setTimezone(body.get("timezone").toString());
                }
                user.setOnboardingCompleted(true);
                userRepository.save(user);

                Map<String, Object> resp = new HashMap<>();
                resp.put("id", user.getId());
                resp.put("name", user.getName());
                resp.put("email", user.getEmail());
                resp.put("onboardingCompleted", true);
                resp.put("college", user.getCollege());
                resp.put("course", user.getCourse());
                resp.put("year", user.getYear());
                resp.put("timezone", user.getTimezone());
                return ResponseEntity.ok(resp);
            })
            .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found")));
    }

    // ==========================================
    // Real Data Tasks Endpoints
    // ==========================================

    @GetMapping("/tasks")
    public ResponseEntity<?> getTasks(
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        
        Long userId = resolveUserId(xUserId, authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        List<Task> tasks = taskRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return ResponseEntity.ok(tasks);
    }

    @PostMapping("/tasks")
    public ResponseEntity<?> createTask(
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Task taskInput) {
        
        Long userId = resolveUserId(xUserId, authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        if (taskInput.getTitle() == null || taskInput.getTitle().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Title is required"));
        }

        Task task = new Task();
        task.setUserId(userId);
        task.setTitle(taskInput.getTitle().trim());
        task.setDescription(taskInput.getDescription());
        task.setDeadline(taskInput.getDeadline());
        task.setEstimatedMinutes(taskInput.getEstimatedMinutes() != null ? taskInput.getEstimatedMinutes() : 45);
        task.setPriority(taskInput.getPriority() != null ? taskInput.getPriority() : "MEDIUM");
        task.setCategory(taskInput.getCategory() != null ? taskInput.getCategory() : "Academic");
        task.setSource(taskInput.getSource() != null ? taskInput.getSource() : "MANUAL");
        task.setStatus("PENDING");
        task.setPostponementCount(0);

        Task saved = taskRepository.save(task);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PatchMapping("/tasks/{id}")
    public ResponseEntity<?> updateTask(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> updates) {
        
        Long userId = resolveUserId(xUserId, authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        Optional<Task> optTask = taskRepository.findByIdAndUserId(id, userId);
        if (optTask.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Task not found"));
        }

        Task task = optTask.get();
        if (updates.containsKey("status") && updates.get("status") != null) {
            task.setStatus(updates.get("status").toString());
        }
        if (updates.containsKey("deadline")) {
            task.setDeadline(updates.get("deadline") != null ? updates.get("deadline").toString() : null);
        }
        if (updates.containsKey("title") && updates.get("title") != null) {
            task.setTitle(updates.get("title").toString());
        }
        if (updates.containsKey("priority") && updates.get("priority") != null) {
            task.setPriority(updates.get("priority").toString());
        }
        if (updates.containsKey("postponementCount") && updates.get("postponementCount") != null) {
            try {
                task.setPostponementCount(Integer.parseInt(updates.get("postponementCount").toString()));
            } catch (NumberFormatException ignored) {}
        }
        Task saved = taskRepository.save(task);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/tasks/{id}")
    public ResponseEntity<?> deleteTask(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        
        Long userId = resolveUserId(xUserId, authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        Optional<Task> optTask = taskRepository.findByIdAndUserId(id, userId);
        if (optTask.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Task not found"));
        }

        taskRepository.delete(optTask.get());
        return ResponseEntity.ok(Map.of("message", "Task deleted successfully", "id", id));
    }

    // ==========================================
    // Grounded Ask SAGE Assistant Endpoint
    // ==========================================

    @PostMapping("/sage/ask")
    public ResponseEntity<?> askSage(
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> payload) {
        
        Long userId = resolveUserId(xUserId, authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        String prompt = payload.getOrDefault("prompt", "").toString();
        if (prompt.trim().isEmpty() && payload.containsKey("message") && payload.get("message") != null) {
            prompt = payload.get("message").toString();
        }

        User user = userRepository.findById(userId).orElse(null);
        List<Task> tasks = taskRepository.findByUserIdOrderByCreatedAtDesc(userId);

        List<Task> pending = new ArrayList<>();
        List<Task> urgent = new ArrayList<>();
        int totalMinutes = 0;

        for (Task t : tasks) {
            if ("PENDING".equalsIgnoreCase(t.getStatus())) {
                pending.add(t);
                if ("HIGH".equalsIgnoreCase(t.getPriority())) {
                    urgent.add(t);
                }
                totalMinutes += (t.getEstimatedMinutes() != null ? t.getEstimatedMinutes() : 45);
            }
        }

        Task topPriority = !urgent.isEmpty() ? urgent.get(0) : (!pending.isEmpty() ? pending.get(0) : null);

        if (!geminiAiService.isConfigured()) {
            Map<String, Object> unconfiguredResp = new HashMap<>();
            unconfiguredResp.put("error", "SAGE AI assistant is unavailable: Backend GEMINI_API_KEY environment variable is not configured. Please set GEMINI_API_KEY in the backend environment to enable AI-powered assistance.");
            unconfiguredResp.put("configured", false);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(unconfiguredResp);
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> extraContext = payload.containsKey("context") && payload.get("context") instanceof Map
                    ? (Map<String, Object>) payload.get("context")
                    : Collections.emptyMap();

            auth_service.service.GeminiAiService.SageAiResult aiResult = geminiAiService.generateResponse(user, tasks, prompt, extraContext);

            String action;
            if (topPriority != null) {
                action = "Focus on " + topPriority.getTitle() + " (" + (topPriority.getEstimatedMinutes() != null ? topPriority.getEstimatedMinutes() : 45) + "m)";
            } else {
                action = "Review Today's Schedule";
            }

            Map<String, Object> resp = new HashMap<>();
            resp.put("message", aiResult.content());
            resp.put("reply", aiResult.content());
            resp.put("action", action);
            resp.put("reasoning", "Generated by " + aiResult.model() + " (" + aiResult.provider() + ") grounded in student tasks.");
            resp.put("conversationId", payload.getOrDefault("conversationId", "conv-" + UUID.randomUUID()));
            resp.put("responseId", aiResult.responseId());
            resp.put("timestamp", java.time.Instant.now().toString());
            resp.put("pendingTasksCount", pending.size());
            resp.put("totalMinutes", totalMinutes);
            if (topPriority != null) {
                resp.put("topTaskId", topPriority.getId());
                resp.put("topTaskTitle", topPriority.getTitle());
            }
            resp.put("configured", true);
            resp.put("provider", aiResult.provider());
            resp.put("model", aiResult.model());

            return ResponseEntity.ok(resp);

        } catch (auth_service.service.GeminiAiService.AiRateLimitException e) {
            log.warn("event=gemini_rate_limited userId={}", userId);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("error", e.getMessage()));
        } catch (auth_service.service.GeminiAiService.AiTimeoutException e) {
            return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT).body(Map.of("error", e.getMessage()));
        } catch (auth_service.service.GeminiAiService.AiAuthenticationException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", e.getMessage()));
        } catch (auth_service.service.GeminiAiService.AiServiceException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("event=gemini_request_failed userId={}", userId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "SAGE AI assistant could not process that request."));
        }
    }

    private String requestId() {
        var attributes = org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
        Object id = attributes == null ? null : attributes.getAttribute("requestId", org.springframework.web.context.request.RequestAttributes.SCOPE_REQUEST);
        return id == null ? "unknown" : id.toString();
    }
}
