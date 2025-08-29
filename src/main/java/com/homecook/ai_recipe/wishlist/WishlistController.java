// src/main/java/com/homecook/ai_recipe/wishlist/WishlistController.java
package com.homecook.ai_recipe.wishlist;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.homecook.ai_recipe.auth.SessionUser;
import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import com.homecook.ai_recipe.service.OAuthAccountService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/wishlist")
@RequiredArgsConstructor
public class WishlistController {

    private final WishlistItemRepository repo;
    private final UserAccountRepository userRepo;
    private final OAuthAccountService oauthService;
    private final ObjectMapper om = new ObjectMapper();

    /** 세션에서 실제 UserAccount 찾아오기 (로컬/소셜 모두 지원) */
    private UserAccount requireUser(HttpSession session) {
        SessionUser su = (SessionUser) session.getAttribute("LOGIN_USER");
        if (su == null) throw new RuntimeException("401");

        // 1) 로컬(or local-or-linked)은 providerId가 내부 user id(숫자)
        if ("local".equalsIgnoreCase(su.provider()) || "local-or-linked".equalsIgnoreCase(su.provider())) {
            try {
                Long uid = Long.valueOf(su.providerId());
                return userRepo.findById(uid).orElseThrow(() -> new RuntimeException("401"));
            } catch (NumberFormatException ignore) {
                // 숫자 아닐 경우 아래로 폴백
            }
        }

        // 2) 소셜: provider/providerId 링크로 매칭
        var linked = oauthService.findByProvider(su.provider(), su.providerId());
        if (linked.isPresent()) return linked.get();

        // 3) 이메일 매칭(일부 소셜에서 email 제공)
        if (su.email() != null && !su.email().isBlank()) {
            var byEmail = userRepo.findByEmailIgnoreCase(su.email());
            if (byEmail.isPresent()) return byEmail.get();
        }

        throw new RuntimeException("401");
    }

    /** 내 위시리스트 목록 */
    @GetMapping
    public ResponseEntity<?> list(HttpSession session) {
        try {
            var me = requireUser(session);
            var list = repo.findByUserOrderByCreatedAtDesc(me);
            return ResponseEntity.ok(list);
        } catch (RuntimeException e) {
            if ("401".equals(e.getMessage()))
                return ResponseEntity.status(401).body(Map.of("message","unauthenticated"));
            throw e;
        }
    }

    /** 저장/해제 토글 */
    @PostMapping("/toggle")
    public ResponseEntity<?> toggle(@RequestBody Map<String,Object> body, HttpSession session) {
        try {
            var me = requireUser(session);
            String key = safeStr(body.get("key")).trim();
            if (key.isBlank())
                return ResponseEntity.badRequest().body(Map.of("message","key is required"));

            var found = repo.findByUserAndItemKey(me, key);
            if (found.isPresent()) {
                repo.delete(found.get());
                return ResponseEntity.ok(Map.of("saved", false));
            }

            String title   = safeStr(body.get("title")).trim();
            String summary = opt(body, "summary");
            String image   = opt(body, "image");
            String meta    = opt(body, "meta");

            String payloadJson = null;
            Object payload = body.get("payload");
            if (payload != null) {
                try { payloadJson = om.writeValueAsString(payload); } catch (Exception ignored) {}
            }

            WishlistItem item = WishlistItem.builder()
                    .user(me).itemKey(key)
                    .title(title.isBlank() ? "레시피" : title)
                    .summary(summary).image(image).meta(meta)
                    .payloadJson(payloadJson)
                    .build();
            repo.save(item);
            return ResponseEntity.ok(Map.of("saved", true));
        } catch (RuntimeException e) {
            if ("401".equals(e.getMessage()))
                return ResponseEntity.status(401).body(Map.of("message","unauthenticated"));
            throw e;
        }
    }

    /** 현재 저장 여부 조회 (카드 로드시 체크용) */
    @GetMapping("/exists")
    public ResponseEntity<?> exists(@RequestParam("key") String key, HttpSession session) {
        try {
            var me = requireUser(session);
            boolean ok = repo.existsByUserAndItemKey(me, key);
            return ResponseEntity.ok(Map.of("saved", ok));
        } catch (RuntimeException e) {
            if ("401".equals(e.getMessage()))
                return ResponseEntity.status(401).body(Map.of("message","unauthenticated"));
            throw e;
        }
    }

    /** 강제 해제 */
    @DeleteMapping("/{key}")
    public ResponseEntity<?> remove(@PathVariable String key, HttpSession session) {
        try {
            var me = requireUser(session);
            long n = repo.deleteByUserAndItemKey(me, key);
            return ResponseEntity.ok(Map.of("removed", n > 0));
        } catch (RuntimeException e) {
            if ("401".equals(e.getMessage()))
                return ResponseEntity.status(401).body(Map.of("message","unauthenticated"));
            throw e;
        }
    }

    private static String opt(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return (v == null) ? null : String.valueOf(v);
    }
    private static String safeStr(Object v) { return v == null ? "" : String.valueOf(v); }
}
