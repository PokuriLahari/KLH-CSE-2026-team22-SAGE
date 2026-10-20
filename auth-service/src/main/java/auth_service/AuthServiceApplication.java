package auth_service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@SpringBootApplication
@EnableScheduling
public class AuthServiceApplication {

    private static final Logger log = LoggerFactory.getLogger(AuthServiceApplication.class);

    public static void main(String[] args) {
        loadDotenv();
        SpringApplication.run(AuthServiceApplication.class, args);
    }

    private static void loadDotenv() {
        List<Path> candidatePaths = List.of(
                Path.of(".env"),
                Path.of("../.env")
        );
        for (Path p : candidatePaths) {
            if (Files.exists(p) && Files.isRegularFile(p)) {
                try (var lines = Files.lines(p)) {
                    log.info("Loading environment configuration from: {}", p.toAbsolutePath());
                    lines.forEach(line -> {
                        String trimmed = line.trim();
                        if (!trimmed.isEmpty() && !trimmed.startsWith("#") && trimmed.contains("=")) {
                            int idx = trimmed.indexOf('=');
                            String key = trimmed.substring(0, idx).trim();
                            String val = trimmed.substring(idx + 1).trim();
                            if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
                                if (val.length() >= 2) {
                                    val = val.substring(1, val.length() - 1);
                                }
                            }
                            if (System.getProperty(key) == null && System.getenv(key) == null) {
                                System.setProperty(key, val);
                            }
                        }
                    });
                    break;
                } catch (Exception e) {
                    log.warn("Could not read .env file at {}: {}", p, e.getMessage());
                }
            }
        }
    }
}
