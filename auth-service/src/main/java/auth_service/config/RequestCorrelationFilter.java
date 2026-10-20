package auth_service.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

/** Retains only validated IDs from the gateway; direct/invalid callers receive a new ID. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestCorrelationFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(RequestCorrelationFilter.class);
    private static final Pattern UUID_V4 = Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String incoming = request.getHeader("X-Request-Id");
        String requestId = incoming != null && UUID_V4.matcher(incoming).matches() ? incoming : UUID.randomUUID().toString();
        response.setHeader("X-Request-Id", requestId);
        request.setAttribute("requestId", requestId);
        long started = System.nanoTime();
        try { chain.doFilter(request, response); }
        catch (Exception error) { log.error("event=http_request_exception method={} path={} requestId={}", request.getMethod(), request.getRequestURI(), requestId, error); throw error; }
        finally { log.info("event=http_request method={} path={} status={} durationMs={} requestId={}", request.getMethod(), request.getRequestURI(), response.getStatus(), (System.nanoTime() - started) / 1_000_000, requestId); }
    }
}
