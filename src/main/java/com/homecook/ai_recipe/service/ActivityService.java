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

import java.time.ZoneId;
import java.util.List;
import java.util.Map;

@Service
public class ActivityService {
    private final ActivityLogRepository repo;
    private final UserAccountRepository userRepo;
    private final ObjectMapper om = new ObjectMapper();

    public ActivityService(ActivityLogRepository repo, UserAccountRepository userRepo) {
        this.repo = repo;
        this.userRepo = userRepo;
    }

    public void add(Long userId, ActivityCreateReq req) {
        UserAccount u = userRepo.findById(userId).orElseThrow();
        ActivityLog al = new ActivityLog();
        al.setUser(u);
        al.setType(req.type() == null ? "unknown" : req.type());
        al.setPayloadJson(writeJson(req.data()));
        repo.save(al);
    }

    public ActivityPageRes list(Long userId, int page, int size) {
        var p = repo.findByUser_IdOrderByIdDesc(userId, PageRequest.of(page, size));
        List<ActivityRes> items = p.getContent().stream().map(al ->
                new ActivityRes(
                        al.getId(),
                        al.getType(),
                        al.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli(),
                        readJson(al.getPayloadJson())
                )
        ).toList();
        return new ActivityPageRes(items, p.getTotalElements());
    }

    private String writeJson(Map<String, Object> m) {
        try { return om.writeValueAsString(m == null ? Map.of() : m); }
        catch (Exception e) { return "{}"; }
    }
    private Map<String, Object> readJson(String s) {
        try { return om.readValue(s == null ? "{}" : s, new TypeReference<>(){}); }
        catch (Exception e) { return Map.of(); }
    }
}
