package auth_service.config;

import auth_service.model.User;
import auth_service.repository.UserRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.core.user.OAuth2User;
import java.io.PrintWriter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final UserRepository userRepository;
    private final JwtUtils jwtUtils;

    public SecurityConfig(UserRepository userRepository, JwtUtils jwtUtils) {
        this.userRepository = userRepository;
        this.jwtUtils = jwtUtils;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers("/login/**", "/oauth2/**", "/error").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2Login(oauth2 -> oauth2
                .successHandler((request, response, authentication) -> {
                    response.setContentType("text/plain;charset=UTF-8");
                    OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
                    String googleId = oAuth2User.getAttribute("sub");
                    String email = oAuth2User.getAttribute("email");
                    String name = oAuth2User.getAttribute("name");

                    User user = userRepository.findByGoogleId(googleId)
                        .orElseGet(() -> {
                            User newUser = new User();
                            newUser.setGoogleId(googleId);
                            newUser.setEmail(email);
                            newUser.setName(name);
                            return userRepository.save(newUser);
                        });
                    
                    String token = jwtUtils.generateToken(user.getId(), user.getEmail());

                    try (PrintWriter writer = response.getWriter()) {
                        writer.println("authentication successful");
                        writer.println("User ID: " + user.getId());
                        writer.println("Name: " + user.getName());
                        writer.println("Email: " + user.getEmail());
                        writer.println("JWT: " + token);
                    }
                })
            );

        return http.build();
    }
}
