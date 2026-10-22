package auth_service;

import auth_service.config.JwtUtils;
import auth_service.controller.AuthController;
import auth_service.model.Task;
import auth_service.model.User;
import auth_service.repository.DeletedAccountRepository;
import auth_service.repository.ReminderRepository;
import auth_service.repository.TaskRepository;
import auth_service.repository.UserRepository;
import auth_service.service.GoogleTokenVerifier;
import auth_service.service.GeminiAiService;
import auth_service.service.GroqAiService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

@SpringBootTest
public class AskSageTests {

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

    private User testUser;
    private String testToken;

    @BeforeEach
    void setUp() {
        taskRepository.deleteAll();
        reminderRepository.deleteAll();
        deletedAccountRepository.deleteAll();
        userRepository.findByEmail("sage_student@example.com").ifPresent(userRepository::delete);

        testUser = new User();
        testUser.setEmail("sage_student@example.com");
        testUser.setName("Sage Test Student");
        testUser.setCollege("Stanford University");
        testUser.setCourse("Computer Science");
        testUser.setYear("3rd Year");
        testUser.setTimezone("America/Los_Angeles");
        testUser.setOnboardingCompleted(true);
        testUser = userRepository.save(testUser);

        testToken = jwtUtils.generateToken(testUser.getId(), testUser.getEmail());
    }

    @Test
    void testUnauthenticatedAskSageReturns401() {
        GoogleTokenVerifier mockVerifier = mock(GoogleTokenVerifier.class);
        GeminiAiService mockAiService = mock(GeminiAiService.class);
        AuthController controller = new AuthController(userRepository, taskRepository, deletedAccountRepository,
                reminderRepository, mockVerifier, mockAiService, jwtUtils);

        ResponseEntity<?> response = controller.askSage(null, null, Map.of("message", "What should I do?"));
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    void testUnconfiguredGeminiServiceReturns503HonestError() {
        GoogleTokenVerifier mockVerifier = mock(GoogleTokenVerifier.class);
        GeminiAiService unconfiguredAiService = new GeminiAiService("", "https://generativelanguage.googleapis.com/v1beta", "gemini-3.8-flash", 25);
        AuthController controller = new AuthController(userRepository, taskRepository, deletedAccountRepository,
                reminderRepository, mockVerifier, unconfiguredAiService, jwtUtils);

        ResponseEntity<?> response = controller.askSage(String.valueOf(testUser.getId()), null,
                Map.of("message", "What should I do tonight?"));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(false, body.get("configured"));
        assertTrue(body.get("error").toString().contains("GEMINI_API_KEY"),
                "Error message should explicitly specify GEMINI_API_KEY");
    }

    @Test
    void testConfiguredGeminiReturnsGroundedResponseWithDatabaseContext() {
        // Add a high priority task
        Task t = new Task();
        t.setUserId(testUser.getId());
        t.setTitle("Complete Compiler Lab 3");
        t.setPriority("HIGH");
        t.setEstimatedMinutes(90);
        t.setStatus("PENDING");
        t.setCategory("Academic");
        taskRepository.save(t);

        GoogleTokenVerifier mockVerifier = mock(GoogleTokenVerifier.class);
        GeminiAiService mockAiService = mock(GeminiAiService.class);
        when(mockAiService.isConfigured()).thenReturn(true);
        when(mockAiService.generateResponse(any(User.class), anyList(), eq("What should I do first?"), anyMap()))
                .thenReturn(new GeminiAiService.SageAiResult(
                        "I recommend starting immediately with 'Complete Compiler Lab 3' as it is high priority with an estimated 90 minutes duration.",
                        "gemini-resp-101",
                        "gemini-3.8-flash",
                        "google-gemini"
                ));

        AuthController controller = new AuthController(userRepository, taskRepository, deletedAccountRepository,
                reminderRepository, mockVerifier, mockAiService, jwtUtils);

        ResponseEntity<?> response = controller.askSage(
                String.valueOf(testUser.getId()),
                "Bearer " + testToken,
                Map.of("message", "What should I do first?")
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);

        assertEquals("gemini-resp-101", body.get("responseId"));
        assertTrue(body.get("message").toString().contains("Complete Compiler Lab 3"));
        assertEquals(body.get("message"), body.get("reply")); // Frontend contract compatibility
        assertEquals(1, body.get("pendingTasksCount"));
        assertEquals(90, body.get("totalMinutes"));
        assertEquals(t.getId(), body.get("topTaskId"));
        assertEquals("Focus on Complete Compiler Lab 3 (90m)", body.get("action"));
        assertEquals(true, body.get("configured"));
        assertEquals("google-gemini", body.get("provider"));
        assertEquals("gemini-3.8-flash", body.get("model"));
    }

    @Test
    void testAiRateLimitTranslatesTo429() {
        GoogleTokenVerifier mockVerifier = mock(GoogleTokenVerifier.class);
        GeminiAiService mockAiService = mock(GeminiAiService.class);
        when(mockAiService.isConfigured()).thenReturn(true);
        when(mockAiService.generateResponse(any(), any(), any(), any()))
                .thenThrow(new GeminiAiService.AiRateLimitException("SAGE AI assistant is experiencing high traffic or quota limits. Please retry in a few moments."));

        AuthController controller = new AuthController(userRepository, taskRepository, deletedAccountRepository,
                reminderRepository, mockVerifier, mockAiService, jwtUtils);

        ResponseEntity<?> response = controller.askSage(
                String.valueOf(testUser.getId()),
                null,
                Map.of("message", "Prioritize my week")
        );

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue(body.get("error").toString().contains("high traffic or quota limits"));
    }

    @Test
    void testAiTimeoutTranslatesTo504() {
        GoogleTokenVerifier mockVerifier = mock(GoogleTokenVerifier.class);
        GeminiAiService mockAiService = mock(GeminiAiService.class);
        when(mockAiService.isConfigured()).thenReturn(true);
        when(mockAiService.generateResponse(any(), any(), any(), any()))
                .thenThrow(new GeminiAiService.AiTimeoutException("AI provider request timed out or network connection failed."));

        AuthController controller = new AuthController(userRepository, taskRepository, deletedAccountRepository,
                reminderRepository, mockVerifier, mockAiService, jwtUtils);

        ResponseEntity<?> response = controller.askSage(
                String.valueOf(testUser.getId()),
                null,
                Map.of("message", "Prioritize my week")
        );

        assertEquals(HttpStatus.GATEWAY_TIMEOUT, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue(body.get("error").toString().contains("timed out"));
    }

    @Test
    void testAiAuthenticationFailureTranslatesTo502() {
        GoogleTokenVerifier mockVerifier = mock(GoogleTokenVerifier.class);
        GeminiAiService mockAiService = mock(GeminiAiService.class);
        when(mockAiService.isConfigured()).thenReturn(true);
        when(mockAiService.generateResponse(any(), any(), any(), any()))
                .thenThrow(new GeminiAiService.AiAuthenticationException("Google Gemini authentication failed. Please verify your GEMINI_API_KEY configuration."));

        AuthController controller = new AuthController(userRepository, taskRepository, deletedAccountRepository,
                reminderRepository, mockVerifier, mockAiService, jwtUtils);

        ResponseEntity<?> response = controller.askSage(
                String.valueOf(testUser.getId()),
                null,
                Map.of("message", "Prioritize my week")
        );

        assertEquals(HttpStatus.BAD_GATEWAY, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue(body.get("error").toString().contains("GEMINI_API_KEY"));
    }

    @Test
    void testGeminiConfigurationKeyAndDefaults() {
        GeminiAiService geminiService = new GeminiAiService("AIzaSyTestKey1234567890", "https://generativelanguage.googleapis.com/v1beta", "gemini-3.8-flash", 25);
        assertTrue(geminiService.isConfigured());
        assertEquals("google-gemini", geminiService.getProviderName());
        assertEquals("gemini-3.8-flash", geminiService.getModel());
        assertEquals("https://generativelanguage.googleapis.com/v1beta", geminiService.getBaseUrl());
        assertEquals(25, geminiService.getTimeoutSeconds());
    }

    @Test
    void testGeminiFallbackKeyDetectedWhenPrimaryKeyAbsent() {
        GeminiAiService fallbackService = new GeminiAiService(
                "",
                "test-fallback-gemini-key-98765",
                "https://generativelanguage.googleapis.com/v1beta",
                "gemini-3.8-flash",
                25
        );
        assertTrue(fallbackService.isConfigured(), "Fallback key should configure Gemini when primary key is missing");
        assertEquals("google-gemini", fallbackService.getProviderName());
        assertEquals("gemini-3.8-flash", fallbackService.getModel());
    }

    @Test
    void testGeminiDirectInvocationWithMockRestClient() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer mockServer = MockRestServiceServer.bindTo(builder).build();

        String mockResponseBody = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          { "text": "Start with Algorithms Homework due tomorrow." }
                        ],
                        "role": "model"
                      },
                      "finishReason": "STOP",
                      "index": 0
                    }
                  ],
                  "modelVersion": "gemini-3.8-flash",
                  "responseId": "gemini-mock-response-001"
                }
                """;

        mockServer.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("x-goog-api-key", "test-secret-key"))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andRespond(withSuccess(mockResponseBody, MediaType.APPLICATION_JSON));

        RestClient restClient = builder.baseUrl("https://generativelanguage.googleapis.com/v1beta").build();
        GeminiAiService geminiService = new GeminiAiService("test-secret-key", "https://generativelanguage.googleapis.com/v1beta", "gemini-3.8-flash", 25, restClient);

        Task sampleTask = new Task();
        sampleTask.setId(10L);
        sampleTask.setTitle("Algorithms Homework");
        sampleTask.setStatus("PENDING");
        sampleTask.setPriority("HIGH");
        sampleTask.setEstimatedMinutes(60);

        GeminiAiService.SageAiResult result = geminiService.generateResponse(testUser, List.of(sampleTask), "What should I do first?", Map.of());

        assertNotNull(result);
        assertEquals("Start with Algorithms Homework due tomorrow.", result.content());
        assertEquals("gemini-mock-response-001", result.responseId());
        assertEquals("gemini-3.8-flash", result.model());
        assertEquals("google-gemini", result.provider());

        mockServer.verify();
    }

    @Test
    void testGeminiMalformedResponseHandlingThrowsAiServiceException() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer mockServer = MockRestServiceServer.bindTo(builder).build();

        // Response with empty candidates array
        mockServer.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"candidates\": []}", MediaType.APPLICATION_JSON));

        RestClient restClient = builder.baseUrl("https://generativelanguage.googleapis.com/v1beta").build();
        GeminiAiService geminiService = new GeminiAiService("test-secret-key", "https://generativelanguage.googleapis.com/v1beta", "gemini-3.8-flash", 25, restClient);

        assertThrows(GeminiAiService.AiServiceException.class, () -> {
            geminiService.generateResponse(testUser, List.of(), "Hello", Map.of());
        });

        mockServer.verify();
    }

    @Test
    void testGeminiNoFallbackProviderCalledOnFailure() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer mockServer = MockRestServiceServer.bindTo(builder).build();

        // Simulate 429 Too Many Requests from Gemini
        mockServer.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withTooManyRequests());

        RestClient restClient = builder.baseUrl("https://generativelanguage.googleapis.com/v1beta").build();
        GeminiAiService geminiService = new GeminiAiService("test-secret-key", "https://generativelanguage.googleapis.com/v1beta", "gemini-3.8-flash", 25, restClient);

        // Must throw AiRateLimitException directly; must NOT attempt Groq/xAI fallback
        assertThrows(GeminiAiService.AiRateLimitException.class, () -> {
            geminiService.generateResponse(testUser, List.of(), "Plan my tasks", Map.of());
        });

        mockServer.verify();
    }

    @Test
    void testMultimodalGeminiInvocationWithImageAttachment() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer mockServer = MockRestServiceServer.bindTo(builder).build();

        String mockResponseBody = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          { "text": "Extracted 1 assignment from exam circular.\\n\\n```sage-action\\n{\\n  \\"type\\": \\"tasks\\",\\n  \\"items\\": [\\n    {\\n      \\"title\\": \\"Physics Assignment 4\\",\\n      \\"deadline\\": \\"2026-10-25T17:00:00\\",\\n      \\"priority\\": \\"HIGH\\",\\n      \\"confidence\\": \\"HIGH\\"\\n    }\\n  ]\\n}\\n```" }
                        ],
                        "role": "model"
                      },
                      "finishReason": "STOP",
                      "index": 0
                    }
                  ],
                  "modelVersion": "gemini-3.8-flash",
                  "responseId": "gemini-multimodal-001"
                }
                """;

        // Expect request containing inline_data part
        mockServer.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("x-goog-api-key", "test-secret-key"))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.contents[0].parts[0].inline_data.mime_type").value("image/png"))
                .andExpect(jsonPath("$.contents[0].parts[0].inline_data.data").value("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="))
                .andRespond(withSuccess(mockResponseBody, MediaType.APPLICATION_JSON));

        RestClient restClient = builder.baseUrl("https://generativelanguage.googleapis.com/v1beta").build();
        GeminiAiService geminiService = new GeminiAiService("test-secret-key", "https://generativelanguage.googleapis.com/v1beta", "gemini-3.8-flash", 25, restClient);

        Map<String, Object> attachment = Map.of(
                "name", "exam_notice.png",
                "mimeType", "image/png",
                "data", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        );

        GeminiAiService.SageAiResult result = geminiService.generateResponse(
                testUser,
                List.of(),
                "Please parse this notice",
                Map.of(),
                attachment
        );

        assertNotNull(result);
        assertTrue(result.content().contains("Physics Assignment 4"));
        assertTrue(result.content().contains("```sage-action"));
        assertEquals("gemini-multimodal-001", result.responseId());
        mockServer.verify();
    }

    @Test
    void testMultimodalGeminiRejectsUnsupportedMimeType() {
        GeminiAiService geminiService = new GeminiAiService("test-key", "https://generativelanguage.googleapis.com/v1beta", "gemini-3.8-flash", 25);

        Map<String, Object> badAttachment = Map.of(
                "name", "script.exe",
                "mimeType", "application/x-msdownload",
                "data", "dGVzdA=="
        );

        GeminiAiService.AiServiceException ex = assertThrows(GeminiAiService.AiServiceException.class, () -> {
            geminiService.generateResponse(testUser, List.of(), "Analyze this", Map.of(), badAttachment);
        });

        assertTrue(ex.getMessage().contains("Unsupported attachment type"));
    }

    @Test
    void testTaskCreationEnforcesOwnershipAndIdempotency() {
        GoogleTokenVerifier mockVerifier = mock(GoogleTokenVerifier.class);
        GeminiAiService mockAiService = mock(GeminiAiService.class);
        AuthController controller = new AuthController(userRepository, taskRepository, deletedAccountRepository,
                reminderRepository, mockVerifier, mockAiService, jwtUtils);

        Task input = new Task();
        input.setTitle("Calculus Problem Set 2");
        input.setDeadline("2026-10-24T23:59:00");
        input.setPriority("HIGH");
        input.setEstimatedMinutes(60);
        // Attempt to supply a forged user id
        input.setUserId(999999L);

        // 1. First creation
        ResponseEntity<?> firstResp = controller.createTask(
                String.valueOf(testUser.getId()),
                "Bearer " + testToken,
                input
        );
        assertEquals(HttpStatus.CREATED, firstResp.getStatusCode());
        Task createdTask = (Task) firstResp.getBody();
        assertNotNull(createdTask);
        // Server MUST enforce authenticated user id, ignoring client-provided 999999L
        assertEquals(testUser.getId(), createdTask.getUserId());
        assertEquals("Calculus Problem Set 2", createdTask.getTitle());

        // 2. Idempotent second creation with same title and deadline
        ResponseEntity<?> secondResp = controller.createTask(
                String.valueOf(testUser.getId()),
                "Bearer " + testToken,
                input
        );
        assertEquals(HttpStatus.OK, secondResp.getStatusCode(), "Repeated creation should return existing task with 200 OK");
        Task duplicateResult = (Task) secondResp.getBody();
        assertNotNull(duplicateResult);
        assertEquals(createdTask.getId(), duplicateResult.getId(), "Should return existing task id without creating duplicates");

        // Verify total tasks in DB for user is still exactly 1
        List<Task> userTasks = taskRepository.findByUserIdOrderByCreatedAtDesc(testUser.getId());
        assertEquals(1, userTasks.size());
    }

    @Test
    void testPrimaryGroqSuccessReturnsGroqProviderInAskSageEndpoint() {
        GoogleTokenVerifier mockVerifier = mock(GoogleTokenVerifier.class);
        GroqAiService mockGroq = mock(GroqAiService.class);
        when(mockGroq.isConfigured()).thenReturn(true);
        when(mockGroq.getModel()).thenReturn("llama-3.3-70b-versatile");
        when(mockGroq.generateResponse(any(User.class), anyList(), anyString(), anyMap(), any()))
                .thenReturn(new GeminiAiService.SageAiResult(
                        "Here is your Groq-optimized study plan.",
                        "chatcmpl-test-groq-1",
                        "llama-3.3-70b-versatile",
                        "groq"
                ));

        GeminiAiService orchestrator = new GeminiAiService(mockGroq, "test-gemini-key", "https://gemini.api", "gemini-3.8-flash", 25, mock(RestClient.class));
        AuthController controller = new AuthController(userRepository, taskRepository, deletedAccountRepository,
                reminderRepository, mockVerifier, orchestrator, jwtUtils);

        ResponseEntity<?> response = controller.askSage(String.valueOf(testUser.getId()), null,
                Map.of("message", "What should I do?"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals("groq", body.get("provider"));
        assertEquals("llama-3.3-70b-versatile", body.get("model"));
        assertEquals("Here is your Groq-optimized study plan.", body.get("message"));
        assertTrue(body.get("reasoning").toString().contains("groq"));
    }

    @Test
    void testPrimaryGroqFailureFallsBackToGoogleGemini() {
        GroqAiService mockGroq = mock(GroqAiService.class);
        when(mockGroq.isConfigured()).thenReturn(true);
        when(mockGroq.getModel()).thenReturn("llama-3.3-70b-versatile");
        // Simulate Groq rate limiting failure (429)
        when(mockGroq.generateResponse(any(User.class), anyList(), anyString(), anyMap(), any()))
                .thenThrow(new GeminiAiService.AiRateLimitException("Groq rate limit exceeded"));

        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer mockServer = MockRestServiceServer.bindTo(builder).build();
        String mockGeminiJson = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          { "text": "Fallback plan from Google Gemini." }
                        ],
                        "role": "model"
                      },
                      "finishReason": "STOP",
                      "index": 0
                    }
                  ],
                  "responseId": "gemini-fallback-123"
                }
                """;
        mockServer.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(mockGeminiJson, MediaType.APPLICATION_JSON));

        RestClient restClient = builder.baseUrl("https://generativelanguage.googleapis.com/v1beta").build();
        GeminiAiService orchestrator = new GeminiAiService(mockGroq, "test-gemini-key", "https://generativelanguage.googleapis.com/v1beta", "gemini-3.8-flash", 25, restClient);

        GeminiAiService.SageAiResult result = orchestrator.generateResponse(testUser, List.of(), "Study plan", Map.of(), null);
        assertNotNull(result);
        assertEquals("Fallback plan from Google Gemini.", result.content());
        assertEquals("google-gemini", result.provider());
        assertEquals("gemini-fallback-123", result.responseId());
        mockServer.verify();
    }

    @Test
    void testUnconfiguredGroqFallsBackToGeminiDirectly() {
        GroqAiService mockGroq = mock(GroqAiService.class);
        when(mockGroq.isConfigured()).thenReturn(false);

        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer mockServer = MockRestServiceServer.bindTo(builder).build();
        String mockGeminiJson = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          { "text": "Direct answer from Google Gemini." }
                        ],
                        "role": "model"
                      },
                      "finishReason": "STOP",
                      "index": 0
                    }
                  ],
                  "responseId": "gemini-direct-456"
                }
                """;
        mockServer.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(mockGeminiJson, MediaType.APPLICATION_JSON));

        RestClient restClient = builder.baseUrl("https://generativelanguage.googleapis.com/v1beta").build();
        GeminiAiService orchestrator = new GeminiAiService(mockGroq, "test-gemini-key", "https://generativelanguage.googleapis.com/v1beta", "gemini-3.8-flash", 25, restClient);

        GeminiAiService.SageAiResult result = orchestrator.generateResponse(testUser, List.of(), "Study plan", Map.of(), null);
        assertNotNull(result);
        assertEquals("Direct answer from Google Gemini.", result.content());
        assertEquals("google-gemini", result.provider());
        mockServer.verify();
    }
}

