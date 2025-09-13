// src/main/java/com/homecook/ai_recipe/controller/UploadController.java
package com.homecook.ai_recipe.controller;

import org.springframework.http.MediaType;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.*;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/uploads")
public class UploadController {

    private final Path root = Paths.get("uploads"); // 프로젝트 루트에 /uploads

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) throw new IllegalArgumentException("파일이 비어 있습니다.");

        // 폴더: /uploads/2025-09-13 같은 형태
        LocalDate today = LocalDate.now();
        Path dir = root.resolve(today.toString());
        Files.createDirectories(dir);

        String ext = Optional.ofNullable(StringUtils.getFilenameExtension(file.getOriginalFilename()))
                .map(String::toLowerCase).orElse("bin");
        String basename = UUID.randomUUID().toString().replace("-", "");
        String filename = basename + "." + ext;

        Path dest = dir.resolve(filename);
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, dest, StandardCopyOption.REPLACE_EXISTING);
        }

        // 정적 URL: /static/uploads/...
        String url = "/static/uploads/" + today + "/" + filename;
        return Map.of("url", url, "name", filename, "size", file.getSize(), "type", file.getContentType());
    }
}
