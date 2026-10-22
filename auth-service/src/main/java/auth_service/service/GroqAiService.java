package auth_service.service;

import auth_service.model.Task;
import auth_service.model.User;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.*;

/**
 * High-performance primary AI service integrating Groq Cloud API (LPU Inference Engine).
 * Uses OpenAI-compatible chat completions endpoint (/chat/completions).
 */
@Service
public class GroqAiService {

    private static final Logger log = LoggerFactory.getLogger(GroqAiService.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private final String apiKey;
    private final String baseUrl;
    private final String model;
    private final String visionModel;
    private final int timeoutSeconds;
    private final RestClient restClient;

    @Autowired
    public GroqAiService(
            @Value("${sage.ai.groq.api-key:${GROQ_API_KEY:}}") String apiKey,
            @Value("${sage.ai.groq.base-url:${GROQ_BASE_URL:https://api.groq.com/openai/v1}}") String baseUrl,
            @Value("${sage.ai.groq.model:${GROQ_MODEL:llama-3.3-70b-versatile}}") String model,
            @Value("${sage.ai.groq.vision-model:${GROQ_VISION_MODEL:llama-3.2-11b-vision-preview}}") String visionModel,
            @Value("${sage.ai.groq.timeout-seconds:${GROQ_TIMEOUT_SECONDS:25}}") int timeoutSeconds) {
        this(apiKey, baseUrl, model, visionModel, timeoutSeconds, createDefaultRestClient(baseUrl, timeoutSeconds));
    }

    public GroqAiService(String apiKey, String baseUrl, String model, int timeoutSeconds) {
        this(apiKey, baseUrl, model, "llama-3.2-11b-vision-preview", timeoutSeconds, createDefaultRestClient(baseUrl, timeoutSeconds));
    }

    public GroqAiService(String apiKey, String baseUrl, String model, String visionModel, int timeoutSeconds, RestClient restClient) {
        this.apiKey = (apiKey != null) ? apiKey.trim() : "";
        this.baseUrl = (baseUrl != null && !baseUrl.isBlank()) ? baseUrl.trim().replaceAll("/+$", "") : "https://api.groq.com/openai/v1";
        this.model = (model != null && !model.isBlank()) ? model.trim() : "llama-3.3-70b-versatile";
        this.visionModel = (visionModel != null && !visionModel.isBlank()) ? visionModel.trim() : "llama-3.2-11b-vision-preview";
        this.timeoutSeconds = timeoutSeconds > 0 ? timeoutSeconds : 25;
        this.restClient = restClient;
    }

    private static RestClient createDefaultRestClient(String baseUrl, int timeoutSeconds) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(timeoutSeconds > 0 ? timeoutSeconds : 25));

        String effectiveBase = (baseUrl != null && !baseUrl.isBlank()) ? baseUrl.trim().replaceAll("/+$", "") : "https://api.groq.com/openai/v1";
        return RestClient.builder()
                .requestFactory(requestFactory)
                .baseUrl(effectiveBase)
                .build();
    }

    public boolean isConfigured() {
        return !apiKey.isEmpty()
                && !apiKey.equalsIgnoreCase("dummy")
                && !apiKey.equalsIgnoreCase("placeholder")
                && !apiKey.contains("your_");
    }

    public String getModel() {
        return model;
    }

    public String getVisionModel() {
        return visionModel;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    public String getProviderName() {
        return "groq";
    }

    public GeminiAiService.SageAiResult generateResponse(User user, List<Task> tasks, String userPrompt, Map<String, Object> extraContext) {
        return generateResponse(user, tasks, userPrompt, extraContext, null);
    }

    public GeminiAiService.SageAiResult generateResponse(
            User user,
            List<Task> tasks,
            String userPrompt,
            Map<String, Object> extraContext,
            Map<String, Object> attachment) {

        if (!isConfigured()) {
            throw new GeminiAiService.AiNotConfiguredException(
                    "SAGE AI assistant is unavailable: Backend GROQ_API_KEY environment variable is not configured. Please set GROQ_API_KEY in the backend environment to enable Groq AI-powered assistance.");
        }

        String systemPrompt = GeminiAiService.buildSystemPrompt(user, tasks, extraContext);
        String finalUserPrompt = userPrompt != null ? userPrompt.trim() : "";
        if (finalUserPrompt.isEmpty() && (attachment == null || attachment.isEmpty())) {
            finalUserPrompt = "What should I work on next given my deadlines and schedule?";
        }

        List<Map<String, Object>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));

        String chosenModel = this.model;
        if (attachment != null && !attachment.isEmpty()) {
            chosenModel = this.visionModel;
            String mimeType = attachment.getOrDefault("mimeType", "").toString().trim().toLowerCase();
            String data = attachment.getOrDefault("data", "").toString().trim();
            if (data.contains(",")) {
                data = data.substring(data.indexOf(",") + 1).trim();
            }

            Set<String> supportedMimes = Set.of(
                    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"
            );
            if (!supportedMimes.contains(mimeType)) {
                throw new GeminiAiService.AiServiceException("Unsupported attachment type: " + mimeType + ". Supported: PNG, JPEG, WEBP, GIF.");
            }
            if (data.length() > 14_000_000) {
                throw new GeminiAiService.AiServiceException("Attachment exceeds maximum supported size (10MB).");
            }

            String dataUrl = "data:" + (mimeType.equals("image/jpg") ? "image/jpeg" : mimeType) + ";base64," + data;
            List<Map<String, Object>> userContent = List.of(
                    Map.of("type", "text", "text", finalUserPrompt.isEmpty() ? "Please analyze this uploaded document/image for academic tasks and timetable schedule." : finalUserPrompt),
                    Map.of("type", "image_url", "image_url", Map.of("url", dataUrl))
            );
            messages.add(Map.of("role", "user", "content", userContent));
        } else {
            messages.add(Map.of("role", "user", "content", finalUserPrompt));
        }

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", chosenModel);
        requestBody.put("messages", messages);
        requestBody.put("temperature", 0.2);
        requestBody.put("max_tokens", 2048);

        try {
            long started = System.nanoTime();
            log.info("Dispatching Ask SAGE query to Groq Cloud (model={}, user={})", chosenModel, user != null ? user.getId() : "anon");

            GroqChatResponse response = restClient.post()
                    .uri("/chat/completions")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(GroqChatResponse.class);

            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                throw new GeminiAiService.AiServiceException("Upstream Groq service returned an empty response.");
            }

            GroqChoice choice = response.choices().get(0);
            if (choice.message() == null || choice.message().content() == null || choice.message().content().isBlank()) {
                throw new GeminiAiService.AiServiceException("Upstream Groq service returned blank content.");
            }

            String content = choice.message().content().trim();
            String responseId = (response.id() != null && !response.id().isBlank())
                    ? response.id()
                    : "sage-groq-" + UUID.randomUUID();

            log.info("event=groq_response status=success latencyMs={} model={}", (System.nanoTime() - started) / 1_000_000, chosenModel);
            return new GeminiAiService.SageAiResult(
                    content,
                    responseId,
                    chosenModel,
                    "groq"
            );

        } catch (HttpClientErrorException.Unauthorized | HttpClientErrorException.Forbidden e) {
            log.error("event=groq_failure category=authentication status={}", e.getStatusCode().value());
            throw new GeminiAiService.AiAuthenticationException("Groq authentication failed. Please verify your GROQ_API_KEY configuration.");
        } catch (HttpClientErrorException.TooManyRequests e) {
            log.warn("event=groq_failure category=quota status=429 model={}", chosenModel);
            throw new GeminiAiService.AiRateLimitException("Groq AI service is experiencing high traffic or quota limits. Please retry in a few moments.");
        } catch (HttpClientErrorException.NotFound e) {
            log.warn("event=groq_failure category=model_or_endpoint status={} model={}", e.getStatusCode().value(), chosenModel);
            throw new GeminiAiService.AiServiceException("Configured Groq model or endpoint is unavailable. Please verify GROQ_MODEL.");
        } catch (HttpClientErrorException e) {
            String errorMsg = parseGroqErrorMessage(e.getResponseBodyAsString(), e.getStatusCode().value());
            log.error("event=groq_failure category=client status={} detail={}", e.getStatusCode().value(), errorMsg);
            throw new GeminiAiService.AiServiceException("Groq request failed (" + e.getStatusCode().value() + "): " + errorMsg);
        } catch (HttpServerErrorException e) {
            log.warn("event=groq_failure category=server status={} model={}", e.getStatusCode().value(), chosenModel);
            throw new GeminiAiService.AiServiceException("Groq upstream service error (" + e.getStatusCode().value() + "). Please try again later.");
        } catch (ResourceAccessException e) {
            log.warn("event=groq_failure category=network_or_timeout model={}", chosenModel);
            throw new GeminiAiService.AiTimeoutException("Groq AI request timed out or network connection failed.");
        } catch (GeminiAiService.AiNotConfiguredException | GeminiAiService.AiAuthenticationException | GeminiAiService.AiRateLimitException | GeminiAiService.AiTimeoutException | GeminiAiService.AiServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error during Groq AI invocation: {}", e.getMessage(), e);
            throw new GeminiAiService.AiServiceException("Unable to process AI request via Groq at this time.");
        }
    }

    private String parseGroqErrorMessage(String responseBody, int statusCode) {
        if (responseBody != null && !responseBody.isBlank()) {
            try {
                JsonNode root = objectMapper.readTree(responseBody);
                if (root.has("error") && root.get("error").has("message")) {
                    return root.get("error").get("message").asText();
                }
            } catch (Exception ignored) {}
        }
        return "HTTP " + statusCode;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record GroqChatResponse(
            String id,
            String model,
            List<GroqChoice> choices
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record GroqChoice(
            int index,
            GroqMessage message,
            @JsonProperty("finish_reason") String finishReason
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record GroqMessage(
            String role,
            String content
    ) {}
}
