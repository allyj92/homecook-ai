package com.homecook.ai_recipe.controller;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.io.InputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;

@RestController
@RequestMapping("/api/img-proxy")
public class ImageProxyController {

    @GetMapping
    public ResponseEntity<byte[]> fetch(@RequestParam("u") String u) throws IOException {
        URL target = new URL(u);
        HttpURLConnection conn = (HttpURLConnection) target.openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(3000);
        conn.setReadTimeout(6000);
        conn.setRequestProperty("User-Agent", "RecipFree/1.0 (+img-proxy)");
        conn.connect();

        int code = conn.getResponseCode();
        if (code >= 400) {
            return ResponseEntity.status(code).build();
        }

        String ctype = conn.getContentType();
        try (InputStream in = conn.getInputStream()) {
            byte[] body = in.readAllBytes();
            return ResponseEntity.ok()
                    .header("Content-Type", ctype != null ? ctype : "image/jpeg")
                    .header("Cache-Control", "public, max-age=86400")
                    .body(body);
        }
    }
}