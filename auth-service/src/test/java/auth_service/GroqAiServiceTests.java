package auth_service;

import auth_service.model.User;
import auth_service.service.GeminiAiService;
import auth_service.service.GroqAiService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

public class GroqAiServiceTests {

    @Test
    void testGroqIsConfigured() {
        GroqAiService configured = new GroqAiService("gsk_valid_key_123", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", 25);
        assertTrue(configured.isConfigured());

        GroqAiService unconfiguredEmpty = new GroqAiService("", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", 25);
        assertFalse(unconfiguredEmpty.isConfigured());

        GroqAiService unconfiguredPlaceholder = new GroqAiService("gsk_your_groq_api_key_here", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", 25);
        assertFalse(unconfiguredPlaceholder.isConfigured());

        GroqAiService unconfiguredDummy = new GroqAiService("dummy", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", 25);
        assertFalse(unconfiguredDummy.isConfigured());
    }

    @Test
    void testGroqUnconfiguredThrowsAiNotConfiguredException() {
        GroqAiService service = new GroqAiService("", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", 25);
        assertThrows(GeminiAiService.AiNotConfiguredException.class, () -> {
            service.generateResponse(new User(), List.of(), "What to do?", Map.of());
        });
    }

    @Test
    @SuppressWarnings("unchecked")
    void testGroqSuccessfulResponseParsing() {
        RestClient restClient = mock(RestClient.class);
        RestClient.RequestBodyUriSpec uriSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec responseSpec = mock(RestClient.ResponseSpec.class);

        when(restClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri("/chat/completions")).thenReturn(bodySpec);
        when(bodySpec.header(eq(HttpHeaders.AUTHORIZATION), eq("Bearer gsk_valid_key"))).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.accept(any())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(responseSpec);

        GroqAiService.GroqMessage mockMsg = new GroqAiService.GroqMessage("assistant", "Start by completing Compiler Lab 3 before 5 PM.");
        GroqAiService.GroqChoice mockChoice = new GroqAiService.GroqChoice(0, mockMsg, "stop");
        GroqAiService.GroqChatResponse mockResponse = new GroqAiService.GroqChatResponse("chatcmpl-test-123", "llama-3.3-70b-versatile", List.of(mockChoice));

        when(responseSpec.body(GroqAiService.GroqChatResponse.class)).thenReturn(mockResponse);

        GroqAiService service = new GroqAiService("gsk_valid_key", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", "llama-3.2-11b-vision-preview", 25, restClient);
        GeminiAiService.SageAiResult result = service.generateResponse(new User(), List.of(), "What should I do?", Map.of());

        assertNotNull(result);
        assertEquals("Start by completing Compiler Lab 3 before 5 PM.", result.content());
        assertEquals("chatcmpl-test-123", result.responseId());
        assertEquals("llama-3.3-70b-versatile", result.model());
        assertEquals("groq", result.provider());
    }

    @Test
    @SuppressWarnings("unchecked")
    void testGroqRateLimitHandling() {
        RestClient restClient = mock(RestClient.class);
        RestClient.RequestBodyUriSpec uriSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);

        when(restClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri("/chat/completions")).thenReturn(bodySpec);
        when(bodySpec.header(eq(HttpHeaders.AUTHORIZATION), anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.accept(any())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);

        HttpClientErrorException rateLimitEx = HttpClientErrorException.create(
                HttpStatus.TOO_MANY_REQUESTS,
                "Too Many Requests",
                HttpHeaders.EMPTY,
                "{\"error\":{\"message\":\"Rate limit exceeded\",\"code\":\"rate_limit_exceeded\"}}".getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8
        );
        when(bodySpec.retrieve()).thenThrow(rateLimitEx);

        GroqAiService service = new GroqAiService("gsk_valid_key", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", "llama-3.2-11b-vision-preview", 25, restClient);
        assertThrows(GeminiAiService.AiRateLimitException.class, () -> {
            service.generateResponse(new User(), List.of(), "What should I do?", Map.of());
        });
    }

    @Test
    @SuppressWarnings("unchecked")
    void testGroqAuthenticationErrorHandling() {
        RestClient restClient = mock(RestClient.class);
        RestClient.RequestBodyUriSpec uriSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);

        when(restClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri("/chat/completions")).thenReturn(bodySpec);
        when(bodySpec.header(eq(HttpHeaders.AUTHORIZATION), anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.accept(any())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);

        HttpClientErrorException authEx = HttpClientErrorException.create(
                HttpStatus.UNAUTHORIZED,
                "Unauthorized",
                HttpHeaders.EMPTY,
                "{\"error\":{\"message\":\"Invalid API Key\"}}".getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8
        );
        when(bodySpec.retrieve()).thenThrow(authEx);

        GroqAiService service = new GroqAiService("gsk_invalid_key", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", "llama-3.2-11b-vision-preview", 25, restClient);
        assertThrows(GeminiAiService.AiAuthenticationException.class, () -> {
            service.generateResponse(new User(), List.of(), "What should I do?", Map.of());
        });
    }

    @Test
    @SuppressWarnings("unchecked")
    void testGroqNetworkTimeoutHandling() {
        RestClient restClient = mock(RestClient.class);
        RestClient.RequestBodyUriSpec uriSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);

        when(restClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri("/chat/completions")).thenReturn(bodySpec);
        when(bodySpec.header(eq(HttpHeaders.AUTHORIZATION), anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.accept(any())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenThrow(new ResourceAccessException("Connection timed out"));

        GroqAiService service = new GroqAiService("gsk_valid_key", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", "llama-3.2-11b-vision-preview", 25, restClient);
        assertThrows(GeminiAiService.AiTimeoutException.class, () -> {
            service.generateResponse(new User(), List.of(), "What should I do?", Map.of());
        });
    }

    @Test
    @SuppressWarnings("unchecked")
    void testGroqMultimodalInvocationWithImage() {
        RestClient restClient = mock(RestClient.class);
        RestClient.RequestBodyUriSpec uriSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec responseSpec = mock(RestClient.ResponseSpec.class);

        when(restClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri("/chat/completions")).thenReturn(bodySpec);
        when(bodySpec.header(eq(HttpHeaders.AUTHORIZATION), anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.accept(any())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(responseSpec);

        GroqAiService.GroqMessage mockMsg = new GroqAiService.GroqMessage("assistant", "Found Operating Systems Lab Assignment in image.");
        GroqAiService.GroqChoice mockChoice = new GroqAiService.GroqChoice(0, mockMsg, "stop");
        GroqAiService.GroqChatResponse mockResponse = new GroqAiService.GroqChatResponse("chatcmpl-vision-456", "llama-3.2-11b-vision-preview", List.of(mockChoice));

        when(responseSpec.body(GroqAiService.GroqChatResponse.class)).thenReturn(mockResponse);

        GroqAiService service = new GroqAiService("gsk_valid_key", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", "llama-3.2-11b-vision-preview", 25, restClient);
        Map<String, Object> attachment = Map.of(
                "mimeType", "image/png",
                "data", "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        );

        GeminiAiService.SageAiResult result = service.generateResponse(new User(), List.of(), "Extract tasks", Map.of(), attachment);
        assertNotNull(result);
        assertEquals("Found Operating Systems Lab Assignment in image.", result.content());
        assertEquals("llama-3.2-11b-vision-preview", result.model());
        assertEquals("groq", result.provider());
    }
}
