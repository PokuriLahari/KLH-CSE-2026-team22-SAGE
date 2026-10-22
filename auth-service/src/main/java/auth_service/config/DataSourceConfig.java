package auth_service.config;

import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;

import javax.sql.DataSource;
import java.net.URI;
import java.net.URISyntaxException;

@Configuration
public class DataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DataSourceConfig.class);

    @Bean
    @Primary
    public DataSource dataSource(
            Environment env,
            @Value("${spring.datasource.url:}") String springUrl,
            @Value("${spring.datasource.username:}") String springUsername,
            @Value("${spring.datasource.password:}") String springPassword,
            @Value("${spring.datasource.driver-class-name:org.postgresql.Driver}") String driverClassName) {

        String databaseUrl = cleanEnvVar(env.getProperty("DATABASE_URL"));
        if (databaseUrl == null || databaseUrl.isBlank()) {
            databaseUrl = cleanEnvVar(System.getenv("DATABASE_URL"));
        }

        String cleanedSpringUrl = cleanEnvVar(springUrl);

        // 1. If DATABASE_URL is provided in standard URI format (e.g. from Neon, Render, or Heroku)
        if (databaseUrl != null && !databaseUrl.isBlank() && isUriFormat(databaseUrl)) {
            log.info("Configuring DataSource from DATABASE_URL...");
            return createDataSourceFromUri(databaseUrl, driverClassName);
        }

        // 2. If SPRING_DATASOURCE_URL was provided in raw postgresql:// or postgres:// URI format
        if (cleanedSpringUrl != null && !cleanedSpringUrl.isBlank() && isUriFormat(cleanedSpringUrl)) {
            log.info("Configuring DataSource from raw URI formatted SPRING_DATASOURCE_URL...");
            return createDataSourceFromUri(cleanedSpringUrl, driverClassName);
        }

        // 3. Otherwise use standard spring.datasource configuration
        log.info("Configuring DataSource from standard spring.datasource properties...");
        HikariDataSource ds = new HikariDataSource();
        String finalJdbcUrl = (cleanedSpringUrl != null && !cleanedSpringUrl.isBlank())
                ? cleanedSpringUrl
                : "jdbc:postgresql://localhost:5432/authdb";

        // If credentials are embedded in jdbc URL (e.g., jdbc:postgresql://user:pass@host/db), sanitize it
        if (finalJdbcUrl.startsWith("jdbc:postgresql://") && finalJdbcUrl.contains("@")) {
            return createDataSourceFromUri(finalJdbcUrl.substring(5), driverClassName);
        }

        ds.setJdbcUrl(finalJdbcUrl);
        ds.setUsername(springUsername != null && !springUsername.isBlank() ? springUsername.trim() : "postgres");
        ds.setPassword(springPassword != null && !springPassword.isBlank() ? springPassword.trim() : "postgres");
        ds.setDriverClassName(driverClassName);
        return ds;
    }

    private static String cleanEnvVar(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
            if (trimmed.length() >= 2) {
                trimmed = trimmed.substring(1, trimmed.length() - 1).trim();
            }
        }
        return trimmed;
    }

    private static boolean isUriFormat(String url) {
        return url.startsWith("postgres://") || url.startsWith("postgresql://");
    }

    private DataSource createDataSourceFromUri(String rawUrl, String driverClassName) {
        try {
            // Replace protocol with https for standard Java URI parsing
            String uriString = rawUrl.replaceFirst("^(postgresql|postgres)://", "https://");
            URI uri = new URI(uriString);

            String host = uri.getHost();
            int port = uri.getPort() == -1 ? 5432 : uri.getPort();
            String path = uri.getPath(); // e.g. /neondb
            String rawQuery = uri.getRawQuery();

            String username = null;
            String password = null;
            if (uri.getUserInfo() != null) {
                String[] parts = uri.getUserInfo().split(":", 2);
                username = parts[0];
                if (parts.length > 1) {
                    password = parts[1];
                }
            }

            StringBuilder jdbcUrl = new StringBuilder();
            jdbcUrl.append("jdbc:postgresql://").append(host).append(":").append(port).append(path);

            if (rawQuery != null && !rawQuery.isBlank()) {
                jdbcUrl.append("?").append(rawQuery);
                if (!rawQuery.contains("sslmode=")) {
                    jdbcUrl.append("&sslmode=require");
                }
            } else {
                jdbcUrl.append("?sslmode=require");
            }

            log.info("PostgreSQL JDBC DataSource configured for host: {}, database: {} (SSL active)", host, path);

            HikariDataSource ds = new HikariDataSource();
            ds.setJdbcUrl(jdbcUrl.toString());
            if (username != null) {
                ds.setUsername(username);
            }
            if (password != null) {
                ds.setPassword(password);
            }
            ds.setDriverClassName(driverClassName != null && !driverClassName.isBlank() ? driverClassName : "org.postgresql.Driver");
            return ds;
        } catch (URISyntaxException e) {
            log.error("Failed to parse PostgreSQL URI, falling back to raw URL: {}", e.getMessage());
            HikariDataSource ds = new HikariDataSource();
            ds.setJdbcUrl(rawUrl.startsWith("jdbc:") ? rawUrl : "jdbc:" + rawUrl);
            ds.setDriverClassName("org.postgresql.Driver");
            return ds;
        }
    }
}
