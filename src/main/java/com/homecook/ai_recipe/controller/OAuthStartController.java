package com.homecook.ai_recipe.controller;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;

@Controller
@RequestMapping("/api/auth/oauth")
public class OAuthStartController {

    @GetMapping("/{registrationId}/start")
    public RedirectView start(@PathVariable String registrationId) {
        // /api/auth/oauth/naver/start  →  /oauth2/authorization/naver 로 302
        RedirectView rv = new RedirectView("/oauth2/authorization/" + registrationId);
        rv.setStatusCode(HttpStatus.FOUND);
        return rv;
    }
}
