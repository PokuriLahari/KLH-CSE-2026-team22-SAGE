package auth_service;

import auth_service.controller.ContestController;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class ContestControllerTests {

    private ObjectMapper objectMapper;
    private HttpClient mockHttpClient;
    private ContestController controller;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        mockHttpClient = mock(HttpClient.class);
        controller = new ContestController(
                "https://competeapi.vercel.app/contests/upcoming/",
                objectMapper,
                mockHttpClient
        );
    }

    @Test
    void standardizePlatform_identifiesMajorPlatforms() {
        assertEquals("LeetCode", ContestController.standardizePlatform("leetcode"));
        assertEquals("LeetCode", ContestController.standardizePlatform("LeetCode Contests"));
        assertEquals("CodeChef", ContestController.standardizePlatform("code_chef"));
        assertEquals("Codeforces", ContestController.standardizePlatform("codeforces"));
        assertEquals("HackerRank", ContestController.standardizePlatform("hackerrank"));
        assertEquals("AtCoder", ContestController.standardizePlatform("atcoder"));
        assertEquals("Custom Platform", ContestController.standardizePlatform("Custom Platform"));
        assertEquals("Other", ContestController.standardizePlatform(null));
        assertEquals("Other", ContestController.standardizePlatform("   "));
    }

    @Test
    void normalizeContests_correctsLeetCodeDurationAnomalyAndCalculatesStatus() {
        Instant now = Instant.parse("2026-10-23T12:00:00Z");
        long nowMs = now.toEpochMilli();

        // LeetCode contest with inflated durationMs (>24h in ms because provider multiplied by 60)
        // 90 minutes = 5,400,000 ms, but buggy provider returns 324,000,000 ms
        Map<String, Object> leetcode = new HashMap<>();
        leetcode.put("site", "LeetCode");
        leetcode.put("title", "Weekly Contest 450");
        leetcode.put("url", "https://leetcode.com/contest/weekly-contest-450");
        leetcode.put("startTime", nowMs + 3600000); // starts in 1 hour
        leetcode.put("duration", 324000000L); // 90 mins * 60 * 1000 * 60

        // Live contest
        Map<String, Object> live = new HashMap<>();
        live.put("site", "Codeforces");
        live.put("title", "Educational Round 180");
        live.put("url", "https://codeforces.com/contest/2000");
        live.put("startTime", nowMs - 1800000); // started 30 mins ago
        live.put("duration", 7200000L); // 2 hours duration (ends in 90 mins)

        // Ended contest
        Map<String, Object> ended = new HashMap<>();
        ended.put("site", "CodeChef");
        ended.put("title", "Starters 150");
        ended.put("url", "https://codechef.com/START150");
        ended.put("startTime", nowMs - 10000000); // ended in past
        ended.put("duration", 7200000L);

        List<Map<String, Object>> normalized = controller.normalizeContests(List.of(leetcode, live, ended), now);

        assertEquals(3, normalized.size());

        // Verify LeetCode duration was corrected to 5400 seconds (90 min)
        Map<String, Object> normLeet = normalized.get(0);
        assertEquals("LeetCode", normLeet.get("platform"));
        assertEquals("Weekly Contest 450", normLeet.get("name"));
        assertEquals(5400L, normLeet.get("duration"));
        assertEquals("upcoming", normLeet.get("status"));
        assertNotNull(normLeet.get("id"));

        // Verify live contest
        Map<String, Object> normLive = normalized.get(1);
        assertEquals("Codeforces", normLive.get("platform"));
        assertEquals("ongoing", normLive.get("status"));
        assertEquals(7200L, normLive.get("duration"));

        // Verify ended contest
        Map<String, Object> normEnded = normalized.get(2);
        assertEquals("CodeChef", normEnded.get("platform"));
        assertEquals("ended", normEnded.get("status"));
    }

    @Test
    void normalizeContests_skipsMalformedItemsSafely() {
        Instant now = Instant.now();
        Map<String, Object> missingTitle = Map.of("url", "https://example.com", "startTime", 100000L);
        Map<String, Object> missingUrl = Map.of("title", "Test", "startTime", 100000L);
        Map<String, Object> invalidTime = Map.of("title", "Test", "url", "https://example.com", "startTime", -1L);

        List<Map<String, Object>> result = controller.normalizeContests(Arrays.asList(missingTitle, missingUrl, invalidTime, null), now);
        assertTrue(result.isEmpty());
    }

    @Test
    @SuppressWarnings("unchecked")
    void getUpcomingContests_fetchesAndCachesUpstream() throws Exception {
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.statusCode()).thenReturn(200);
        when(mockResponse.body()).thenReturn("""
            [
                {
                    "site": "Codeforces",
                    "title": "Round 999",
                    "url": "https://codeforces.com/contest/999",
                    "startTime": 1800000000000,
                    "duration": 7200000
                }
            ]
        """);

        when(mockHttpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(mockResponse);

        ResponseEntity<Map<String, Object>> response = controller.getUpcomingContests();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        List<Map<String, Object>> contests = (List<Map<String, Object>>) response.getBody().get("contests");
        assertEquals(1, contests.size());
        assertEquals("Codeforces", contests.get(0).get("platform"));
        assertEquals("Round 999", contests.get(0).get("name"));

        // Second call should hit in-memory cache without calling httpClient.send again
        ResponseEntity<Map<String, Object>> cachedResponse = controller.getUpcomingContests();
        assertEquals(HttpStatus.OK, cachedResponse.getStatusCode());
        verify(mockHttpClient, times(1)).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void getUpcomingContests_servesStaleCacheWhenUpstreamFails() throws Exception {
        // Pre-populate stale cache
        Instant past = Instant.now().minusSeconds(600); // 10 mins ago (past 5 min TTL)
        Map<String, Object> cachedContest = Map.of(
                "id", "cached-id-1",
                "platform", "AtCoder",
                "name", "Beginner Contest 400",
                "startTime", Instant.now().plusSeconds(3600).toString(),
                "duration", 6000L,
                "url", "https://atcoder.jp/contests/abc400",
                "status", "upcoming"
        );
        controller.setCacheForTesting(List.of(cachedContest), past);

        // Make upstream fail with HTTP 500
        HttpResponse<String> mockResponse = mock(HttpResponse.class);
        when(mockResponse.statusCode()).thenReturn(500);
        when(mockHttpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(mockResponse);

        ResponseEntity<Map<String, Object>> response = controller.getUpcomingContests();
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        List<Map<String, Object>> contests = (List<Map<String, Object>>) response.getBody().get("contests");
        assertEquals(1, contests.size());
        assertEquals("AtCoder", contests.get(0).get("platform"));
        assertEquals(true, response.getBody().get("stale"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void getUpcomingContests_returnsEmptyListWhenUpstreamFailsAndNoCache() throws Exception {
        controller.clearCacheForTesting();
        when(mockHttpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(new RuntimeException("Connection timed out"));

        ResponseEntity<Map<String, Object>> response = controller.getUpcomingContests();
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        List<Map<String, Object>> contests = (List<Map<String, Object>>) response.getBody().get("contests");
        assertTrue(contests.isEmpty());
    }
}
