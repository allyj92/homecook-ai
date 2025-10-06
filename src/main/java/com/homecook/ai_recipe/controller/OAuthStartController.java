package com.homecook.ai_recipe.controller;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;

@Controller
@RequestMapping("/api/auth/oauth")
public class OAuthStartController {

    @GetMapping("/{provider}/start")
    public String start(@PathVariable String provider) {
        // 예: /api/auth/oauth/naver/start → /oauth2/authorization/naver
        return "redirect:/oauth2/authorization/" + provider;

    }

}
