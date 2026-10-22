package auth_service.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import java.util.List;

/**
 * Transactional email delivery service powered by the Brevo (formerly Sendinblue) v3 REST API.
 * Endpoint: POST /smtp/email
 */
@Service
public class BrevoEmailService {

    private static final Logger log = LoggerFactory.getLogger(BrevoEmailService.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private final String apiKey;
    private final String senderEmail;
    private final String senderName;
    private final RestClient restClient;

    @org.springframework.beans.factory.annotation.Autowired
    public BrevoEmailService(
            @Value("${sage.email.brevo.api-key:}") String apiKey,
            @Value("${sage.email.brevo.sender-email:pokurilaharionedrive@gmail.com}") String senderEmail,
            @Value("${sage.email.brevo.sender-name:SAGE}") String senderName,
            @Value("${sage.email.brevo.base-url:https://api.brevo.com/v3}") String baseUrl) {
        this(apiKey, senderEmail, senderName, createDefaultRestClient(baseUrl));
    }

    public BrevoEmailService(String apiKey, String senderEmail, String senderName, RestClient restClient) {
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.senderEmail = (senderEmail != null && !senderEmail.isBlank())
                ? senderEmail.trim()
                : "pokurilaharionedrive@gmail.com";
        this.senderName = (senderName != null && !senderName.isBlank())
                ? senderName.trim()
                : "SAGE";
        this.restClient = restClient;
    }

    private static RestClient createDefaultRestClient(String baseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(15));

        String effectiveBaseUrl = (baseUrl != null && !baseUrl.isBlank())
                ? baseUrl.trim()
                : "https://api.brevo.com/v3";

        return RestClient.builder()
                .requestFactory(factory)
                .baseUrl(effectiveBaseUrl)
                .build();
    }

    public boolean isConfigured() {
        return !apiKey.isEmpty()
                && !apiKey.equalsIgnoreCase("dummy")
                && !apiKey.equalsIgnoreCase("placeholder")
                && !apiKey.startsWith("your_");
    }

    public String getSenderEmail() {
        return senderEmail;
    }

    public String getSenderName() {
        return senderName;
    }

    public EmailDeliveryResult sendEmail(String toEmail, String subject, String htmlContent) {
        return sendEmail(toEmail, null, subject, htmlContent);
    }

    public EmailDeliveryResult sendEmail(String toEmail, String toName, String subject, String htmlContent) {
        if (!isConfigured()) {
            String msg = "Brevo API key is not configured. Set BREVO_API_KEY in the backend environment.";
            log.warn("Cannot send email reminder: {}", msg);
            return new EmailDeliveryResult(false, null, msg);
        }

        if (toEmail == null || toEmail.isBlank() || !toEmail.contains("@")) {
            return new EmailDeliveryResult(false, null, "Invalid recipient email address.");
        }

        String recipientEmail = toEmail.trim();
        String recipientName = (toName != null && !toName.isBlank()) ? toName.trim() : recipientEmail;
        String emailSubject = (subject != null && !subject.isBlank()) ? subject.trim() : "SAGE Reminder Notification";

        BrevoSender sender = new BrevoSender(this.senderName, this.senderEmail);
        List<BrevoRecipient> recipients = List.of(new BrevoRecipient(recipientEmail, recipientName));
        BrevoSendSmtpEmailRequest request = new BrevoSendSmtpEmailRequest(sender, recipients, emailSubject, htmlContent);

        try {
            log.info("Dispatching transactional email via Brevo to domain [{}], subject: \"{}\"",
                    recipientEmail.substring(recipientEmail.indexOf("@")), emailSubject);

            BrevoSendSmtpEmailResponse response = restClient.post()
                    .uri("/smtp/email")
                    .header("api-key", this.apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(BrevoSendSmtpEmailResponse.class);

            if (response != null && response.messageId() != null && !response.messageId().isBlank()) {
                log.info("Transactional email delivered successfully via Brevo. Message ID: {}", response.messageId());
                return new EmailDeliveryResult(true, response.messageId(), null);
            } else {
                return new EmailDeliveryResult(false, null, "Brevo accepted the request but returned an empty message identifier.");
            }

        } catch (HttpClientErrorException e) {
            String parsedError = parseBrevoErrorMessage(e.getResponseBodyAsString(), e.getStatusCode().value());
            log.error("event=email_delivery_failure provider=brevo category=client status={} detail={}",
                    e.getStatusCode().value(), parsedError);
            return new EmailDeliveryResult(false, null, "Brevo client error (" + e.getStatusCode().value() + "): " + parsedError);
        } catch (HttpServerErrorException e) {
            String errDetail = "Brevo server error (" + e.getStatusCode().value() + ")";
            log.error("Brevo server error encountered: {}", errDetail);
            return new EmailDeliveryResult(false, null, errDetail);
        } catch (ResourceAccessException e) {
            String errDetail = "Brevo network connection timed out or failed.";
            log.error("Brevo network communication failure: {}", errDetail);
            return new EmailDeliveryResult(false, null, errDetail);
        } catch (Exception e) {
            String errDetail = "Unexpected error delivering transactional email via Brevo: " + e.getMessage();
            log.error("Brevo email dispatch failure: {}", errDetail, e);
            return new EmailDeliveryResult(false, null, errDetail);
        }
    }

    private String parseBrevoErrorMessage(String responseBody, int statusCode) {
        if (responseBody != null && !responseBody.isBlank()) {
            try {
                JsonNode root = objectMapper.readTree(responseBody);
                if (root.has("message")) {
                    return root.get("message").asText();
                }
                if (root.has("code")) {
                    return root.get("code").asText();
                }
            } catch (Exception ignored) {
                // Return raw or truncated response if not JSON
            }
        }
        return "HTTP " + statusCode;
    }

    public String buildReminderEmailHtml(
            String studentName,
            String reminderTitle,
            String targetType,
            String eventStartTime,
            String contestUrl) {
        String safeName = (studentName != null && !studentName.isBlank()) ? studentName.trim() : "Student";
        String safeTitle = (reminderTitle != null && !reminderTitle.isBlank()) ? reminderTitle.trim() : "Scheduled SAGE Reminder";

        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"></head>");
        html.append("<body style=\"margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050c24; color: #f1f5f9;\">");
        html.append("<div style=\"max-width: 580px; margin: 0 auto; background-color: #070e28; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);\">");

        // Header
        html.append("<div style=\"margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px;\">");
        html.append("<h2 style=\"margin: 0; color: #60a5fa; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;\">SAGE Productivity Assistant</h2>");
        html.append("<div style=\"font-size: 12px; color: #94a3b8; margin-top: 4px;\">Automated Transactional Reminder Notification</div>");
        html.append("</div>");

        // Greeting
        html.append("<p style=\"color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-top: 0;\">Hi ").append(safeName).append(",</p>");
        html.append("<p style=\"color: #cbd5e1; font-size: 15px; line-height: 1.6;\">You have an upcoming scheduled milestone or deadline registered in your SAGE workspace:</p>");

        // Reminder Card
        html.append("<div style=\"background: rgba(255,255,255,0.05); border-left: 4px solid #3b82f6; border-radius: 8px; padding: 18px 20px; margin: 20px 0;\">");
        html.append("<div style=\"font-size: 18px; font-weight: 600; color: #ffffff; line-height: 1.4;\">").append(safeTitle).append("</div>");

        if (targetType != null && !targetType.isBlank()) {
            html.append("<div style=\"font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 8px;\">Category: ")
                .append(targetType.trim()).append("</div>");
        }

        if (eventStartTime != null && !eventStartTime.isBlank()) {
            html.append("<div style=\"font-size: 13px; color: #38bdf8; margin-top: 6px; font-weight: 500;\">Scheduled Due Time: ")
                .append(eventStartTime.trim()).append("</div>");
        }
        html.append("</div>");

        // Action Button
        if (contestUrl != null && !contestUrl.isBlank()) {
            html.append("<div style=\"margin: 24px 0;\">");
            html.append("<a href=\"").append(contestUrl.trim()).append("\" style=\"background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;\">Go to Contest / Event &rarr;</a>");
            html.append("</div>");
        }

        // Footer
        html.append("<p style=\"color: #64748b; font-size: 12px; line-height: 1.5; margin-top: 32px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px;\">");
        html.append("This is an automated transactional notification sent by your SAGE Assistant via Brevo. You can adjust alert timing and quiet hours in your SAGE account preferences.");
        html.append("</p></div></body></html>");

        return html.toString();
    }

    public record BrevoSender(
            @JsonProperty("name") String name,
            @JsonProperty("email") String email
    ) {}

    public record BrevoRecipient(
            @JsonProperty("email") String email,
            @JsonProperty("name") String name
    ) {}

    public record BrevoSendSmtpEmailRequest(
            @JsonProperty("sender") BrevoSender sender,
            @JsonProperty("to") List<BrevoRecipient> to,
            @JsonProperty("subject") String subject,
            @JsonProperty("htmlContent") String htmlContent
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record BrevoSendSmtpEmailResponse(
            @JsonProperty("messageId") String messageId
    ) {}

    public record EmailDeliveryResult(
            boolean success,
            String messageId,
            String errorMessage
    ) {}
}
