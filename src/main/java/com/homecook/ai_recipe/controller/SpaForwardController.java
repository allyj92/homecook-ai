package com.homecook.ai_recipe.controller;


import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    // 1단계 ~ 5단계까지 확장자 없는 경로만 index.html로 전달
    @GetMapping(value = {
            "/{p1:[^\\.]+}",
            "/{p1:[^\\.]+}/{p2:[^\\.]+}",
            "/{p1:[^\\.]+}/{p2:[^\\.]+}/{p3:[^\\.]+}",
            "/{p1:[^\\.]+}/{p2:[^\\.]+}/{p3:[^\\.]+}/{p4:[^\\.]+}",
            "/{p1:[^\\.]+}/{p2:[^\\.]+}/{p3:[^\\.]+}/{p4:[^\\.]+}/{p5:[^\\.]+}"
    }, produces = MediaType.TEXT_HTML_VALUE)
    public String forwardSpa() {
        return "forward:/index.html";
    }
}