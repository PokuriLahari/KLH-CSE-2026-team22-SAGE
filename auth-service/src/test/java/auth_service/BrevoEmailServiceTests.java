package auth_service;

import auth_service.service.BrevoEmailService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class BrevoEmailServiceTests {

    @Test
    void testIsConfigured() {
        BrevoEmailService configured = new BrevoEmailService("xkeysib-valid-key-123", "sender@sage.dev", "SAGE", (RestClient) null);
        assertTrue(configured.isConfigured());

        BrevoEmailService unconfiguredEmpty = new BrevoEmailService("", "sender@sage.dev", "SAGE", (RestClient) null);
        assertFalse(unconfiguredEmpty.isConfigured());

        BrevoEmailService unconfiguredPlaceholder = new BrevoEmailService("your_brevo_api_key_here", "sender@sage.dev", "SAGE", (RestClient) null);
        assertFalse(unconfiguredPlaceholder.isConfigured());

        BrevoEmailService unconfiguredDummy = new BrevoEmailService("dummy", "sender@sage.dev", "SAGE", (RestClient) null);
        assertFalse(unconfiguredDummy.isConfigured());
    }

    @Test
    void testSendEmailFailsWhenNotConfigured() {
        BrevoEmailService service = new BrevoEmailService("", "sender@sage.dev", "SAGE", (RestClient) null);
        BrevoEmailService.EmailDeliveryResult result = service.sendEmail("student@example.com", "Test", "<p>Hello</p>");

        assertFalse(result.success());
        assertNull(result.messageId());
        assertTrue(result.errorMessage().contains("Brevo API key is not configured"));
    }

    @Test
    void testSendEmailValidatesRecipient() {
        BrevoEmailService service = new BrevoEmailService("xkeysib-test", "sender@sage.dev", "SAGE", (RestClient) null);

        BrevoEmailService.EmailDeliveryResult nullEmail = service.sendEmail(null, "Test", "<p>Hello</p>");
        assertFalse(nullEmail.success());
        assertTrue(nullEmail.errorMessage().contains("Invalid recipient"));

        BrevoEmailService.EmailDeliveryResult invalidEmail = service.sendEmail("not-an-email", "Test", "<p>Hello</p>");
        assertFalse(invalidEmail.success());
        assertTrue(invalidEmail.errorMessage().contains("Invalid recipient"));
    }

    @Test
    void testBuildReminderEmailHtml() {
        BrevoEmailService service = new BrevoEmailService("xkeysib-test", "pokurilaharionedrive@gmail.com", "SAGE", (RestClient) null);
        String html = service.buildReminderEmailHtml(
                "Alice",
                "Operating Systems Project Due",
                "Assignment",
                "2026-10-22 17:00",
                "https://sage.dev/contests/1"
        );

        assertNotNull(html);
        assertTrue(html.contains("Hi Alice"));
        assertTrue(html.contains("Operating Systems Project Due"));
        assertTrue(html.contains("Assignment"));
        assertTrue(html.contains("2026-10-22 17:00"));
        assertTrue(html.contains("https://sage.dev/contests/1"));
        assertTrue(html.contains("Brevo"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void testSendEmailSuccessfulDispatch() {
        RestClient restClient = mock(RestClient.class);
        RestClient.RequestBodyUriSpec uriSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec responseSpec = mock(RestClient.ResponseSpec.class);

        when(restClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri("/smtp/email")).thenReturn(bodySpec);
        when(bodySpec.header(eq("api-key"), anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.accept(any())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(BrevoEmailService.BrevoSendSmtpEmailResponse.class))
                .thenReturn(new BrevoEmailService.BrevoSendSmtpEmailResponse("<brevo-msg-id-888>"));

        BrevoEmailService service = new BrevoEmailService("xkeysib-test", "pokurilaharionedrive@gmail.com", "SAGE", restClient);
        BrevoEmailService.EmailDeliveryResult result = service.sendEmail("alice@example.com", "Test Subject", "<p>Test</p>");

        assertTrue(result.success());
        assertEquals("<brevo-msg-id-888>", result.messageId());
        assertNull(result.errorMessage());
    }

    @Test
    @SuppressWarnings("unchecked")
    void testSendEmailHandlesHttpClientErrorWithParsedMessage() {
        RestClient restClient = mock(RestClient.class);
        RestClient.RequestBodyUriSpec uriSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);

        when(restClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri("/smtp/email")).thenReturn(bodySpec);
        when(bodySpec.header(eq("api-key"), anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.accept(any())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);

        String errorJson = "{\"code\":\"invalid_parameter\",\"message\":\"sender.email is not a verified sender\"}";
        HttpClientErrorException exception = HttpClientErrorException.create(
                HttpStatus.BAD_REQUEST,
                "Bad Request",
                HttpHeaders.EMPTY,
                errorJson.getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8
        );
        when(bodySpec.retrieve()).thenThrow(exception);

        BrevoEmailService service = new BrevoEmailService("xkeysib-test", "pokurilaharionedrive@gmail.com", "SAGE", restClient);
        BrevoEmailService.EmailDeliveryResult result = service.sendEmail("alice@example.com", "Test Subject", "<p>Test</p>");

        assertFalse(result.success());
        assertNull(result.messageId());
        assertTrue(result.errorMessage().contains("sender.email is not a verified sender"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void testSendEmailHandlesNetworkTimeout() {
        RestClient restClient = mock(RestClient.class);
        RestClient.RequestBodyUriSpec uriSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);

        when(restClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri("/smtp/email")).thenReturn(bodySpec);
        when(bodySpec.header(eq("api-key"), anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.accept(any())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenThrow(new ResourceAccessException("Connection timed out"));

        BrevoEmailService service = new BrevoEmailService("xkeysib-test", "pokurilaharionedrive@gmail.com", "SAGE", restClient);
        BrevoEmailService.EmailDeliveryResult result = service.sendEmail("alice@example.com", "Test Subject", "<p>Test</p>");

        assertFalse(result.success());
        assertNull(result.messageId());
        assertTrue(result.errorMessage().contains("Brevo network connection timed out or failed"));
    }
}
