package com.homecook.ai_recipe.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api")
public class UploadController {

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    @Value("${app.cdn-base:}")
    private String cdnBase;

    @PostMapping("/upload")
    public Map<String, String> upload(@RequestParam("file") MultipartFile file,
                                      HttpServletRequest req) throws IOException {
        log.info("[UPLOAD] hit /api/upload, file={}, ct={}",
                (file != null ? file.getOriginalFilename() : null),
                (file != null ? file.getContentType() : null));

        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "empty_file");
        }
        String ct = (file.getContentType() == null ? "" : file.getContentType().toLowerCase());
        if (!ct.startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "only_image_allowed");
        }

        // ── 절대 경로로 저장 디렉터리 구성 ──────────────────────────
        LocalDate d = LocalDate.now();
        Path base = Paths.get(uploadDir,
                        String.valueOf(d.getYear()),
                        String.format("%02d", d.getMonthValue()),
                        String.format("%02d", d.getDayOfMonth()))
                .toAbsolutePath()
                .normalize();

        Files.createDirectories(base); // 상위 폴더까지 생성

        // 확장자 결정
        String origExt = StringUtils.getFilenameExtension(file.getOriginalFilename());
        String ext = (origExt != null && origExt.matches("[A-Za-z0-9]{1,5}"))
                ? origExt.toLowerCase()
                : (ct.contains("png") ? "png" :
                ct.contains("webp") ? "webp" :
                        ct.contains("gif") ? "gif" : "jpg");

        String name = UUID.randomUUID().toString().replace("-", "") + "." + ext;
        Path dest = base.resolve(name).normalize();

        // ── 저장: transferTo 대신 Files.copy 사용 ─────────────────
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, dest, StandardCopyOption.REPLACE_EXISTING);
        }

        // 퍼블릭 URL (/files/** 리소스 핸들러와 매칭)
        String pathPart = "/files/" + d.getYear()
                + "/" + String.format("%02d", d.getMonthValue())
                + "/" + String.format("%02d", d.getDayOfMonth())
                + "/" + name;

        String url;
        if (cdnBase != null && !cdnBase.isBlank()) {
            url = cdnBase.replaceAll("/+$", "") + pathPart;
        } else {
            String origin = req.getRequestURL().toString().replace(req.getRequestURI(), "");
            url = origin + pathPart;
        }

        log.info("[UPLOAD] saved={}, url={}", dest.toAbsolutePath(), url);
        return Map.of("url", url);
    }
}
