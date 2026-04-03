import SwiftUI

struct WidgetPreviewSmall: View {
    var body: some View {
        VStack(spacing: Spacing.md) {
            VStack(spacing: Spacing.md) {
                Text("窗镜子里浮现着冰冷而硕大的雪花，在敞开领口、揩拭脖颈的驹子周围，飘扬着一条条银线。")
                    .font(.system(size: 15, weight: .regular, design: .serif))
                    .foregroundStyle(Color("textPrimary"))
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
            }
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity)
        .aspectRatio(1, contentMode: .fit)
        .background(Color("backgroundPrimary"))
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .stroke(Color("borderSecondary"), lineWidth: 0.5)
        )
    }
}

#Preview("Small") {
    WidgetPreviewSmall()
        .padding()
}
