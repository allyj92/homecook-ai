package com.homecook.ai_recipe.controller;


import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    // HTML을 기대하는 요청만 잡아서 SPA 엔트리(index.html)로 포워딩
    @GetMapping(value = "/{*path}", produces = MediaType.TEXT_HTML_VALUE)
    public String forwardSpa(HttpServletRequest req) {
        String uri = req.getRequestURI();

        // 정적 파일이나 API가 아닌, SPA 라우트만 index로 전달
        if (uri.startsWith("/api/")
                || uri.startsWith("/files/")
                || uri.startsWith("/uploads/")
                || uri.startsWith("/images/")
                || uri.startsWith("/assets/")
                || uri.startsWith("/webjars/")
                || uri.startsWith("/oauth2/")
                || uri.startsWith("/login")
                || uri.startsWith("/logout")
                || uri.startsWith("/error")
                || uri.startsWith("/actuator")) {
            // 이 경우는 원래 매핑(컨트롤러/리소스 핸들러)로 처리되게 해야 하므로
            // 여기서 아무 것도 하지 않게끔: 이 메서드가 매치되지 않도록 위 조건을 좁히는 게 핵심이며,
            // produces=text/html 덕분에 보통은 여기까지 오지 않음.
            return "forward:/"; // 혹은 필요 없으면 "forward:/error" 등으로 변경 가능
        }

        // 점(.)이 들어 있으면 보통 파일 요청이므로 SPA가 아님
        if (uri.contains(".")) {
            return "forward:/"; // 정적 리소스 체인이 처리하게 루트로 넘김
        }

        // 실제 SPA 엔트리 제공 (URL은 /mypage 등 유지)
        return "forward:/";
    }
}