package auth_service.config;

import auth_service.model.User;
import auth_service.repository.DeletedAccountRepository;
import auth_service.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.core.user.OAuth2User;
import jakarta.servlet.http.Cookie;

import java.io.PrintWriter;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final UserRepository userRepository;
    private final DeletedAccountRepository deletedAccountRepository;
    private final JwtUtils jwtUtils;

    @Value("${frontend.url:http://localhost:5173}")
    private String frontendUrl;

    public SecurityConfig(UserRepository userRepository, DeletedAccountRepository deletedAccountRepository, JwtUtils jwtUtils) {
        this.userRepository = userRepository;
        this.deletedAccountRepository = deletedAccountRepository;
        this.jwtUtils = jwtUtils;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**"))
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers("/health", "/healthz", "/login/**", "/oauth2/**", "/error", "/api/**", "/actuator/health").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2Login(oauth2 -> oauth2
                .successHandler((request, response, authentication) -> {
                    OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
                    String googleId = oAuth2User.getAttribute("sub");
                    String email = oAuth2User.getAttribute("email");
                    String name = oAuth2User.getAttribute("name");

                    boolean isDeleted = (googleId != null && deletedAccountRepository.existsByGoogleId(googleId))
                        || (email != null && deletedAccountRepository.existsByEmailIgnoreCase(email.trim().toLowerCase()));
                    if (isDeleted) {
                        Cookie authCookie = new Cookie("sage_token", "");
                        authCookie.setHttpOnly(true);
                        authCookie.setPath("/");
                        authCookie.setMaxAge(0);
                        response.addCookie(authCookie);

                        String acceptHeader = request.getHeader("Accept");
                        if (acceptHeader != null && acceptHeader.contains("text/html")) {
                            response.sendRedirect(frontendUrl + "/login?error=account_deleted");
                            return;
                        }
                        response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_FORBIDDEN);
                        response.setContentType("application/json;charset=UTF-8");
                        try (PrintWriter writer = response.getWriter()) {
                            writer.print("{\"error\":\"This SAGE account was permanently deleted. Automatic recreation is disabled.\",\"code\":\"ACCOUNT_DELETED\"}");
                        }
                        return;
                    }

                    final boolean[] isNew = {false};
                    User user = userRepository.findByGoogleId(googleId)
                        .orElseGet(() -> {
                            if (email != null && !email.trim().isEmpty()) {
                                java.util.Optional<User> existingEmailUser = userRepository.findByEmail(email.trim().toLowerCase());
                                if (existingEmailUser.isPresent()) {
                                    User found = existingEmailUser.get();
                                    found.setGoogleId(googleId);
                                    if (name != null && (found.getName() == null || found.getName().isEmpty())) {
                                        found.setName(name);
                                    }
                                    found.setEmailVerified(true);
                                    return userRepository.save(found);
                                }
                            }
                            isNew[0] = true;
                            User newUser = new User();
                            newUser.setGoogleId(googleId);
                            newUser.setEmail(email != null ? email.trim().toLowerCase() : "");
                            newUser.setName(name);
                            newUser.setAuthProvider("GOOGLE");
                            newUser.setEmailVerified(true);
                            newUser.setNotificationEmail(email != null ? email.trim().toLowerCase() : null);
                            newUser.setNotificationEmailVerified(true);
                            newUser.setOnboardingCompleted(false);
                            return userRepository.save(newUser);
                        });
                    
                    String token = jwtUtils.generateToken(user.getId(), user.getEmail());

                    // Set secure HttpOnly session cookie
                    Cookie authCookie = new Cookie("sage_token", token);
                    authCookie.setHttpOnly(true);
                    authCookie.setPath("/");
                    authCookie.setMaxAge(24 * 60 * 60);
                    response.addCookie(authCookie);

                    // In browser flows, Accept header contains text/html -> redirect to frontend
                    String acceptHeader = request.getHeader("Accept");
                    if (acceptHeader != null && acceptHeader.contains("text/html")) {
                        boolean onboardingCompleted = Boolean.TRUE.equals(user.isOnboardingCompleted());
                        String targetUrl = frontendUrl + "/auth/callback?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8)
                            + "&userId=" + user.getId()
                            + "&email=" + URLEncoder.encode(user.getEmail() != null ? user.getEmail() : "", StandardCharsets.UTF_8)
                            + "&name=" + URLEncoder.encode(user.getName() != null ? user.getName() : "", StandardCharsets.UTF_8)
                            + "&onboardingCompleted=" + onboardingCompleted;
                        response.sendRedirect(targetUrl);
                        return;
                    }

                    // Otherwise output plain-text for tests and direct API invocations
                    response.setContentType("text/plain;charset=UTF-8");
                    try (PrintWriter writer = response.getWriter()) {
                        writer.println("authentication successful");
                        writer.println("User ID: " + user.getId());
                        writer.println("Name: " + (user.getName() != null ? user.getName() : ""));
                        writer.println("Email: " + (user.getEmail() != null ? user.getEmail() : ""));
                        writer.println("JWT: " + token);
                    }
                })
            );

        return http.build();
    }
}
