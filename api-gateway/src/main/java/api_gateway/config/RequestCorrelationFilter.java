package api_gateway.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import org.springframework.http.HttpStatus;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

import java.util.UUID;
import java.util.regex.Pattern;

/** Establishes a validated correlation ID at the public gateway boundary. */
@Component
public class RequestCorrelationFilter implements GlobalFilter, Ordered {
    private static final Logger log = LoggerFactory.getLogger(RequestCorrelationFilter.class);
    private static final Pattern UUID_V4 = Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");

    @Override public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String proposed = exchange.getRequest().getHeaders().getFirst("X-Request-Id");
        String requestId = proposed != null && UUID_V4.matcher(proposed).matches() ? proposed : UUID.randomUUID().toString();
        long started = System.nanoTime();
        ServerHttpRequest request = exchange.getRequest().mutate().headers(headers -> headers.set("X-Request-Id", requestId)).build();
        exchange.getResponse().getHeaders().set("X-Request-Id", requestId);
        return chain.filter(exchange.mutate().request(request).build())
            .doOnSuccess(ignored -> log.info("event=http_request method={} path={} status={} durationMs={} requestId={}", request.getMethod(), request.getURI().getPath(), exchange.getResponse().getStatusCode(), (System.nanoTime() - started) / 1_000_000, requestId))
            .onErrorResume(error -> {
                log.error("event=gateway_request_failure method={} path={} durationMs={} requestId={}", request.getMethod(), request.getURI().getPath(), (System.nanoTime() - started) / 1_000_000, requestId, error);
                if (exchange.getResponse().isCommitted()) return Mono.error(error);
                exchange.getResponse().setStatusCode(HttpStatus.SERVICE_UNAVAILABLE);
                exchange.getResponse().getHeaders().set("Content-Type", "application/json");
                String body = String.format("{\"timestamp\":\"%s\",\"status\":503,\"error\":\"SERVICE_UNAVAILABLE\",\"message\":\"The requested SAGE service is unavailable.\",\"requestId\":\"%s\",\"path\":\"%s\"}", Instant.now(), requestId, request.getURI().getPath());
                return exchange.getResponse().writeWith(Mono.just(exchange.getResponse().bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8))));
            });
    }
    @Override public int getOrder() { return -200; }
}
