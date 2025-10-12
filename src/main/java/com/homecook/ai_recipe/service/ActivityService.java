package com.homecook.ai_recipe.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.homecook.ai_recipe.auth.UserAccount;            // ✅ 누락된 import 추가
import com.homecook.ai_recipe.domain.ActivityLog;
import com.homecook.ai_recipe.dto.ActivityCreateReq;
import com.homecook.ai_recipe.dto.ActivityPageRes;
import com.homecook.ai_recipe.dto.ActivityRes;

import com.homecook.ai_recipe.repo.ActivityLogRepository;



import com.homecook.ai_recipe.repo.UserAccountRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;                  // ✅ 누락된 import 추가
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

@Service
public class ActivityService {

    /** 사용자별 최대 보존 개수(최신순) */
    private static final int MAX_KEEP = 300;

    /** 스트릭(day) 계산 기준 타임존 (한국 기준) */
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final ActivityLogRepository repo;
    private final UserAccountRepository userRepo;
    private final ObjectMapper om; // ✅ 스프링 컨테이너에서 주입

    public ActivityService(
            ActivityLogRepository repo,
            UserAccountRepository userRepo,
            ObjectMapper objectMapper
    ) {
        this.repo = repo;
        this.userRepo = userRepo;
        this.om = objectMapper;
    }

    /** ✅ 하루 1회 스트릭 갱신 (이미 오늘 달성했으면 증가 없음) */
    @Transactional
    public int markDailyActive(Long userId) {
        if (userId == null) return 0;

        var opt = userRepo.findById(userId);
        if (opt.isEmpty()) return 0;

        var u = opt.get();
        LocalDate today = LocalDate.now(KST);
        LocalDate last  = u.getLastActiveDate();

        if (today.equals(last)) {
            // 오늘은 이미 처리됨 (쓰기 없음)
            return u.getStreakDays();
        }

        int next;
        if (last != null && last.plusDays(1).equals(today)) {
            next = Math.min(u.getStreakDays() + 1, 36500); // 안전 상한
        } else {
            next = 1;
        }

        u.setStreakDays(next);
        u.setLastActiveDate(today);
        userRepo.save(u);

        return next;
    }

    /** 활동 추가 + 오래된 로그 정리 */
    @Transactional
    public void add(Long userId, ActivityCreateReq req) {
        // 프록시로 참조만: INSERT 성능에 유리
        UserAccount ref = userRepo.getReferenceById(userId);

        ActivityLog al = new ActivityLog();
        al.setUser(ref);
        al.setType(req.type() == null ? "unknown" : req.type());
        al.setPayloadJson(writeJson(req.data()));
        repo.save(al);

        // ✅ 최신 MAX_KEEP개만 보존 (JPQL 2단계 방식)
        try {
            // keep-1 번째(0-index) 아이디를 경계로 사용: 그보다 작은 id 모두 삭제
            int offset = Math.max(0, MAX_KEEP - 1);
            var page = repo.findIdsByUserOrderByIdDesc(
                    userId,
                    PageRequest.of(offset, 1, Sort.by(Sort.Direction.DESC, "id"))
            );
            if (page.hasContent()) {
                Long boundaryId = page.getContent().get(0);
                repo.deleteOlderThan(userId, boundaryId);
                // 파생 메서드로 만들었다면 아래처럼 대체 가능:
                // repo.deleteByUser_IdAndIdLessThan(userId, boundaryId);
            }
        } catch (Exception ignore) {
            // 정리는 실패해도 기능적으로 문제 없음
        }
    }

    /** 활동 페이지 조회 */
    @Transactional(readOnly = true)
    public ActivityPageRes list(Long userId, int page, int size) {
        int p = Math.max(0, page);
        int s = Math.min(100, Math.max(1, size)); // 과도한 size 방지 (DoS/메모리 방어)

        var pageObj = repo.findByUser_IdOrderByIdDesc(userId, PageRequest.of(p, s));
        List<ActivityRes> items = pageObj.getContent().stream()
                .map(al -> new ActivityRes(
                        al.getId(),
                        al.getType(),
                        al.getCreatedAt()
                                .atZone(ZoneId.systemDefault())
                                .toInstant()
                                .toEpochMilli(),
                        readJson(al.getPayloadJson())
                ))
                .toList();

        return new ActivityPageRes(items, pageObj.getTotalElements());
    }

    /* ---------- JSON 유틸 ---------- */

    private String writeJson(Map<String, Object> m) {
        try {
            return om.writeValueAsString(m == null ? Map.of() : m);
        } catch (Exception e) {
            return "{}";
        }
    }

    private Map<String, Object> readJson(String s) {
        try {
            String src = (s == null || s.isBlank()) ? "{}" : s;
            return om.readValue(src, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }
}
