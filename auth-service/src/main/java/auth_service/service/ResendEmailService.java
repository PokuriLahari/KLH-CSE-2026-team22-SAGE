package auth_service.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
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

@Service
public class ResendEmailService {

    private static final Logger log = LoggerFactory.getLogger(ResendEmailService.class);

    private final BrevoEmailService brevoEmailService;
    private final String apiKey;
    private final String fromAddress;
    private final RestClient restClient;

    @org.springframework.beans.factory.annotation.Autowired
    public ResendEmailService(
            @org.springframework.beans.factory.annotation.Autowired(required = false) BrevoEmailService brevoEmailService,
            @Value("${sage.email.resend.api-key:}") String apiKey,
            @Value("${sage.email.resend.from:SAGE <onboarding@resend.dev>}") String fromAddress) {
        this.brevoEmailService = brevoEmailService;
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.fromAddress = (fromAddress != null && !fromAddress.isBlank()) ? fromAddress.trim() : "SAGE <onboarding@resend.dev>";

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(15));

        this.restClient = RestClient.builder()
                .requestFactory(factory)
                .baseUrl("https://api.resend.com")
                .build();
    }

    public ResendEmailService(
            String apiKey,
            String fromAddress) {
        this(null, apiKey, fromAddress);
    }

    public boolean isConfigured() {
        if (brevoEmailService != null && brevoEmailService.isConfigured()) {
            return true;
        }
        return !apiKey.isEmpty() && !apiKey.equalsIgnoreCase("dummy") && !apiKey.equalsIgnoreCase("placeholder");
    }

    public String getActiveProviderName() {
        if (brevoEmailService != null && brevoEmailService.isConfigured()) {
            return "Brevo";
        }
        return "Resend";
    }

    public String getFromAddress() {
        if (brevoEmailService != null && brevoEmailService.isConfigured()) {
            return brevoEmailService.getSenderName() + " <" + brevoEmailService.getSenderEmail() + ">";
        }
        return fromAddress;
    }

    public EmailDeliveryResult sendEmail(String toEmail, String subject, String htmlContent) {
        if (brevoEmailService != null && brevoEmailService.isConfigured()) {
            log.info("Routing email delivery through active Brevo transactional service");
            BrevoEmailService.EmailDeliveryResult brevoResult = brevoEmailService.sendEmail(toEmail, subject, htmlContent);
            return new EmailDeliveryResult(brevoResult.success(), brevoResult.messageId(), brevoResult.errorMessage());
        }

        if (!isConfigured()) {
            String msg = "Email provider is not configured. Set BREVO_API_KEY or RESEND_API_KEY in the backend environment.";
            log.warn("Cannot send email reminder: {}", msg);
            return new EmailDeliveryResult(false, null, msg);
        }

        if (toEmail == null || toEmail.isBlank() || !toEmail.contains("@")) {
            return new EmailDeliveryResult(false, null, "Invalid recipient email address.");
        }

        ResendEmailRequest request = new ResendEmailRequest(
                this.fromAddress,
                List.of(toEmail.trim()),
                subject != null ? subject : "SAGE Reminder Notification",
                htmlContent
        );

        try {
            log.info("Sending reminder email via Resend to recipient domain [{}], subject: \"{}\"",
                    toEmail.substring(toEmail.indexOf("@")), subject);

            ResendEmailResponse response = restClient.post()
                    .uri("/emails")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(ResendEmailResponse.class);

            if (response != null && response.id() != null) {
                log.info("Email delivered successfully via Resend. Message ID: {}", response.id());
                return new EmailDeliveryResult(true, response.id(), null);
            } else {
                return new EmailDeliveryResult(false, null, "Resend returned empty message identifier.");
            }

        } catch (HttpClientErrorException e) {
            String errDetail = "Resend client error (" + e.getStatusCode() + ")";
            log.error("event=email_delivery_failure provider=resend category=client status={}", e.getStatusCode().value());
            return new EmailDeliveryResult(false, null, errDetail);
        } catch (HttpServerErrorException e) {
            String errDetail = "Resend server error (" + e.getStatusCode() + ")";
            log.error("Resend service error: {}", errDetail);
            return new EmailDeliveryResult(false, null, errDetail);
        } catch (ResourceAccessException e) {
            String errDetail = "Resend connection timed out or failed.";
            log.error("Resend network error: {}", errDetail);
            return new EmailDeliveryResult(false, null, errDetail);
        } catch (Exception e) {
            String errDetail = "Unexpected error delivering email: " + e.getMessage();
            log.error("Email delivery failed: {}", errDetail, e);
            return new EmailDeliveryResult(false, null, errDetail);
        }
    }

    public String buildReminderEmailHtml(String studentName, String reminderTitle, String targetType, String eventStartTime, String contestUrl) {
        String safeName = (studentName != null && !studentName.isBlank()) ? studentName : "Student";
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html><body style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050c24; color: #f1f5f9; padding: 24px;\">");
        html.append("<div style=\"max-width: 580px; margin: 0 auto; background-color: #070e28; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px;\">");
        
        // Header
        html.append("<div style=\"display: flex; align-items: center; margin-bottom: 24px;\">");
        html.append("<h2 style=\"margin: 0; color: #60a5fa; font-size: 20px; font-weight: 700;\">SAGE Productivity Assistant</h2>");
        html.append("</div>");
        
        // Greeting & Body
        html.append("<p style=\"color: #cbd5e1; font-size: 15px; line-height: 1.6;\">Hi ").append(safeName).append(",</p>");
        html.append("<p style=\"color: #cbd5e1; font-size: 15px; line-height: 1.6;\">You have an upcoming scheduled deadline or event:</p>");
        
        // Reminder Card
        html.append("<div style=\"background: rgba(255,255,255,0.05); border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px 20px; margin: 20px 0;\">");
        html.append("<div style=\"font-size: 18px; font-weight: 600; color: #ffffff;\">").append(reminderTitle).append("</div>");
        if (targetType != null && !targetType.isBlank()) {
            html.append("<div style=\"font-size: 13px; color: #94a3b8; text-transform: uppercase; margin-top: 4px;\">Category: ").append(targetType).append("</div>");
        }
        if (eventStartTime != null && !eventStartTime.isBlank()) {
            html.append("<div style=\"font-size: 13px; color: #38bdf8; margin-top: 6px;\">Scheduled Time: ").append(eventStartTime).append("</div>");
        }
        html.append("</div>");

        // Action Link
        if (contestUrl != null && !contestUrl.isBlank()) {
            html.append("<div style=\"margin: 24px 0;\">");
            html.append("<a href=\"").append(contestUrl).append("\" style=\"background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;\">Go to Contest / Event</a>");
            html.append("</div>");
        }

        html.append("<p style=\"color: #64748b; font-size: 13px; line-height: 1.5; margin-top: 32px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px;\">");
        html.append("This is an automated notification from your personal SAGE Assistant. You can configure notification timing and quiet hours in your account settings.");
        html.append("</p></div></body></html>");

        return html.toString();
    }

    public record ResendEmailRequest(
            String from,
            List<String> to,
            String subject,
            String html
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ResendEmailResponse(String id) {}

    public record EmailDeliveryResult(boolean success, String messageId, String errorMessage) {}
}
