package com.untamed.untamedbackend.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParticipantPreviewItem {
    private String userId;
    private String username;
    private String profileImageUrl;
    private String level;
}