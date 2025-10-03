package com.homecook.ai_recipe.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {
    // 제외할 1뎁스 경로들(백엔드/정적자원 prefix)
    private static final String NOT_SPA = "^(?!(?:api|oauth2|login|logout|error|assets|static|css|js|images|fonts)$).*$";

    // /activity, /community, /mypage 같은 1뎁스 경로
    @GetMapping("/{path:" + NOT_SPA + "}")
    public String forward1() {
        return "forward:/index.html";
    }

    // /community/123 처럼 2뎁스 이상 경로
    @GetMapping("/{path:" + NOT_SPA + "}/**")
    public String forward2() {
        return "forward:/index.html";
    }
}
