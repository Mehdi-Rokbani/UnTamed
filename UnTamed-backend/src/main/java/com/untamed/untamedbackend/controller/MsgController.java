package com.untamed.untamedbackend.controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MsgController {
    @RequestMapping("/hi")
    public String msg(){
        return "first api";
    }
}
