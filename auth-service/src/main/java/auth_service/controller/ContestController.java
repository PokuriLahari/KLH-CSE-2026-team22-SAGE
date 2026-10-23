package auth_service.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class ContestController {

    private static final Logger log = LoggerFactory.getLogger(ContestController.class);
    private static final Duration CACHE_DURATION = Duration.ofMinutes(5);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(6);

    private final String upstreamUrl;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public static class CacheEntry {
        public final List<Map<String, Object>> contests;
        public final Instant timestamp;

        public CacheEntry(List<Map<String, Object>> contests, Instant timestamp) {
            this.contests = contests;
            this.timestamp = timestamp;
        }
    }

    private final AtomicReference<CacheEntry> cache = new AtomicReference<>(null);

    @org.springframework.beans.factory.annotation.Autowired
    public ContestController(
            @Value("${sage.contests.api-url:${CONTEST_API_URL:https://competeapi.vercel.app/contests/upcoming/}}") String upstreamUrl,
            ObjectMapper objectMapper) {
        this.upstreamUrl = upstreamUrl;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(REQUEST_TIMEOUT)
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public ContestController(String upstreamUrl, ObjectMapper objectMapper, HttpClient httpClient) {
        this.upstreamUrl = upstreamUrl;
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
    }

    public void clearCacheForTesting() {
        this.cache.set(null);
    }

    public void setCacheForTesting(List<Map<String, Object>> contests, Instant timestamp) {
        this.cache.set(new CacheEntry(contests, timestamp));
    }

    @GetMapping("/contests")
    public ResponseEntity<Map<String, Object>> getUpcomingContests() {
        CacheEntry current = cache.get();
        Instant now = Instant.now();

        if (current != null && Duration.between(current.timestamp, now).compareTo(CACHE_DURATION) < 0) {
            return ResponseEntity.ok(Map.of(
                    "contests", current.contests,
                    "lastUpdated", current.timestamp.toString()
            ));
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(upstreamUrl))
                    .timeout(REQUEST_TIMEOUT)
                    .header("Accept", "application/json")
                    .header("User-Agent", "SAGE-Backend/1.0")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 200) {
                List<Map<String, Object>> rawList = objectMapper.readValue(
                        response.body(),
                        new TypeReference<List<Map<String, Object>>>() {}
                );

                List<Map<String, Object>> normalized = normalizeContests(rawList, now);
                cache.set(new CacheEntry(normalized, now));
                log.info("event=contests_fetched count={} status=200", normalized.size());
                return ResponseEntity.ok(Map.of(
                        "contests", normalized,
                        "lastUpdated", now.toString()
                ));
            } else {
                log.warn("event=contests_upstream_failed status={}", response.statusCode());
            }
        } catch (Exception e) {
            log.warn("event=contests_fetch_error error={}", e.getMessage());
        }

        // Serve stale cache if available
        if (current != null) {
            log.info("event=contests_serving_stale count={}", current.contests.size());
            return ResponseEntity.ok(Map.of(
                    "contests", current.contests,
                    "lastUpdated", current.timestamp.toString(),
                    "stale", true
            ));
        }

        // Return empty list if no upstream data and no cache
        return ResponseEntity.ok(Map.of(
                "contests", Collections.emptyList(),
                "lastUpdated", now.toString()
        ));
    }

    public List<Map<String, Object>> normalizeContests(List<Map<String, Object>> rawList, Instant now) {
        if (rawList == null) return Collections.emptyList();
        List<Map<String, Object>> result = new ArrayList<>();
        long nowMs = now.toEpochMilli();

        for (int i = 0; i < rawList.size(); i++) {
            Map<String, Object> raw = rawList.get(i);
            if (raw == null) continue;

            Object titleObj = raw.get("title");
            Object urlObj = raw.get("url");
            Object startObj = raw.get("startTime");

            if (titleObj == null || urlObj == null || startObj == null) continue;

            String title = String.valueOf(titleObj).trim();
            String url = String.valueOf(urlObj).trim();
            if (title.isEmpty() || url.isEmpty()) continue;

            long startMs;
            try {
                if (startObj instanceof Number n) {
                    startMs = n.longValue();
                } else {
                    startMs = Long.parseLong(String.valueOf(startObj).trim());
                }
            } catch (Exception e) {
                continue;
            }

            if (startMs <= 0) continue;

            String site = raw.get("site") != null ? String.valueOf(raw.get("site")) : "";
            String platform = standardizePlatform(site);

            long durationMs = 0;
            Object durObj = raw.get("duration");
            if (durObj instanceof Number n) {
                durationMs = n.longValue();
            } else if (durObj != null) {
                try {
                    durationMs = Long.parseLong(String.valueOf(durObj).trim());
                } catch (Exception ignored) {}
            }

            if ("LeetCode".equals(platform) && durationMs > 24L * 60 * 60 * 1000) {
                durationMs /= 60;
            }

            long durationSec = Math.max(0, durationMs / 1000);
            long endMs = startMs + (durationSec * 1000);

            String status;
            if (startMs <= nowMs && endMs > nowMs) {
                status = "ongoing";
            } else if (endMs <= nowMs) {
                status = "ended";
            } else {
                status = "upcoming";
            }

            String identity = site + "-" + title + "-" + startMs + "-" + i;
            String id = sha256Hex(identity);

            Map<String, Object> contest = new LinkedHashMap<>();
            contest.put("id", id);
            contest.put("platform", platform);
            contest.put("name", title);
            contest.put("startTime", Instant.ofEpochMilli(startMs).toString());
            contest.put("duration", durationSec);
            contest.put("url", url);
            contest.put("status", status);
            contest.put("lastUpdated", now.toString());
            contest.put("reminder", null);

            result.add(contest);
        }
        return result;
    }

    public static String standardizePlatform(String site) {
        if (site == null) return "Other";
        String key = site.toLowerCase().replaceAll("[\\s_-]", "");
        if (key.contains("leetcode")) return "LeetCode";
        if (key.contains("codechef")) return "CodeChef";
        if (key.contains("codeforces")) return "Codeforces";
        if (key.contains("hackerrank")) return "HackerRank";
        if (key.contains("atcoder")) return "AtCoder";
        return site.trim().isEmpty() ? "Other" : site.trim();
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (int i = 0; i < Math.min(12, hash.length); i++) {
                hex.append(String.format("%02x", hash[i]));
            }
            return hex.toString();
        } catch (Exception e) {
            return Integer.toHexString(input.hashCode());
        }
    }
}
