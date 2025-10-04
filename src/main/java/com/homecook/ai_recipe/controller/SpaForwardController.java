package com.homecook.ai_recipe.controller;


import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    // 확장자 없는 경로만 SPA로 넘김 (이미지/js/css 등은 제외)
    @GetMapping({"/{path:[^\\.]*}", "/{path:^(?!api|files|uploads|images|assets|webjars|oauth2|login|logout).*$}/**"})
    public String forwardMulti() {
        return "forward:/index.html";
    }
}