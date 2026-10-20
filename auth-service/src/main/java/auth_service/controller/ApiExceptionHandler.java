package auth_service.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.Map;

/** Converts uncaught server errors to a safe stable contract while retaining stack traces in logs. */
@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handle(Exception error, HttpServletRequest request) {
        String requestId = String.valueOf(request.getAttribute("requestId"));
        log.error("event=unhandled_api_exception path={} requestId={}", request.getRequestURI(), requestId, error);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "timestamp", Instant.now().toString(), "status", 500, "error", "INTERNAL_SERVER_ERROR",
                "message", "Something went wrong while processing your request.", "requestId", requestId,
                "path", request.getRequestURI()));
    }
}
