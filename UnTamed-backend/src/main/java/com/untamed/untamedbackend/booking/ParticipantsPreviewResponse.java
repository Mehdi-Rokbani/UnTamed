package com.untamed.untamedbackend.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParticipantsPreviewResponse {
    private int totalConfirmed;
    private int seatsLeft;
    private List<ParticipantPreviewItem> participants;
}