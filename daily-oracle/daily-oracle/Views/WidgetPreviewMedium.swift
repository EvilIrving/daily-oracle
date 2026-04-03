import SwiftUI

struct WidgetPreviewMedium: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("窗镜子里浮现着冰冷而硕大的雪花，在敞开领口、揩拭脖颈的驹子周围，飘扬着一条条银线。雪光把房间里的轮廓衬得更浅，仿佛有人把呼吸也停在了玻璃的另一面。")
                .font(.system(size: 15, design: .serif))
                .foregroundStyle(Color("textPrimary"))
                .frame(maxWidth: .infinity, alignment: .leading)
                .lineSpacing(3)

            Text("—— 萧红《生死场》")
                .font(.system(size: 13))
                .foregroundStyle(Color("textTertiary"))
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.top, Spacing.sm)

            Divider()
                .padding(.vertical, Spacing.md)

            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack(spacing: Spacing.sm) {
                    Text("宜：")
                        .font(.system(size: 14))
                        .foregroundStyle(Color("yi"))
                    Text("在自然光下读几页纸质书")
                        .font(.system(size: 14))
                        .foregroundStyle(Color("textSecondary"))
                        .lineLimit(1)
                }

                HStack(spacing: Spacing.sm) {
                    Text("忌：")
                        .font(.system(size: 14))
                        .foregroundStyle(Color("ji"))
                    Text("把休息当成需要被证明才能拥有的东西")
                        .font(.system(size: 14))
                        .foregroundStyle(Color("textSecondary"))
                        .lineLimit(1)
                }
            }
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity)
        .aspectRatio(2.12, contentMode: .fit)
        .background(Color("backgroundPrimary"))
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .stroke(Color("borderSecondary"), lineWidth: 0.5)
        )
    }
}

#Preview("Medium") {
    WidgetPreviewMedium()
        .padding()
}
