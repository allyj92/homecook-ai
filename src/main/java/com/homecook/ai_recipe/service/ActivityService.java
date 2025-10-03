package com.homecook.ai_recipe.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.domain.ActivityLog;
import com.homecook.ai_recipe.dto.ActivityCreateReq;
import com.homecook.ai_recipe.dto.ActivityPageRes;
import com.homecook.ai_recipe.dto.ActivityRes;
import com.homecook.ai_recipe.repo.ActivityLogRepository;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;
import java.util.List;
import java.util.Map;

@Service
public class ActivityService {

    /** 사용자별 최대 보존 개수(최신순) */
    private static final int MAX_KEEP = 300;

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

    @Transactional
    public void add(Long userId, ActivityCreateReq req) {
        // 굳이 SELECT로 로딩할 필요 없이 프록시로 충분 (INSERT 성능 & 경합 ↓)
        UserAccount ref = userRepo.getReferenceById(userId);

        ActivityLog al = new ActivityLog();
        al.setUser(ref);
        al.setType(req.type() == null ? "unknown" : req.type());
        al.setPayloadJson(writeJson(req.data()));
        repo.save(al);

        // ✅ 사용자별 최신 MAX_KEEP개만 보존(오래된 것 정리)
        try {
            repo.pruneOld(userId, MAX_KEEP);
        } catch (Exception ignore) {
            // 정리는 실패해도 기능적 문제 없음
        }
    }

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