package auth_service.service;

/**
 * @deprecated Replaced by {@link GeminiAiService}.
 * Kept for backwards compatibility with any legacy references.
 */
@Deprecated
public class GrokAiService extends GeminiAiService {

    public GrokAiService(String apiKey, String baseUrl, String model, int timeoutSeconds) {
        super(apiKey, baseUrl, model, timeoutSeconds);
    }

    public GrokAiService(String explicitProvider, String groqApiKey, String groqBaseUrl, String groqModel,
                         String xaiApiKey, String xaiBaseUrl, String xaiModel, int timeoutSeconds) {
        super((groqApiKey != null && !groqApiKey.isEmpty()) ? groqApiKey : xaiApiKey,
                "https://generativelanguage.googleapis.com/v1beta",
                "gemini-3.8-flash",
                timeoutSeconds);
    }
}
