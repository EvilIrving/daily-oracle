import SwiftUI

struct WidgetPreviewLarge: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            
            Text("窗镜子里浮现着冰冷而硕大的雪花，在敞开领口、揩拭脖颈的驹子周围，飘扬着一条条银线。雪光把房间里的轮廓衬得更浅，仿佛有人把呼吸也停在了玻璃的另一面。")
                .font(.system(size: 17, design: .serif))
                .foregroundStyle(Color("textPrimary"))

            Text("— 加西亚·马尔克斯")
                .font(.system(size: 13))
                .foregroundStyle(Color("textTertiary"))
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.top, Spacing.sm)

            Divider()
                .padding(.vertical, Spacing.md)

            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack(spacing: Spacing.sm) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color("yi"))
                        .frame(width: 4, height: 16)

                    Text("出门走一段不常走的路，看陌生的窗口")
                        .font(.system(size: 14))
                        .foregroundStyle(Color("textSecondary"))
                        .lineLimit(1)
                }

                HStack(spacing: Spacing.sm) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color("ji"))
                        .frame(width: 4, height: 16)

                    Text("用沉默代替真正想说的话")
                        .font(.system(size: 14))
                        .foregroundStyle(Color("textSecondary"))
                        .lineLimit(1)
                }
            }

            HStack(spacing: 6) {
                ForEach(QuoteMood.allCases) { mood in
                    HStack(spacing: 4) {
                        Circle()
                            .fill(mood.color)
                            .frame(width: 5, height: 5)

                        Text(mood.label)
                            .font(.system(size: 10.5))
                            .foregroundStyle(Color("textSecondary"))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 28)
                }
            }
            .padding(.top, Spacing.md)
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity)
        .aspectRatio(0.955, contentMode: .fit)
        .background(Color("backgroundPrimary"))
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .stroke(Color("borderSecondary"), lineWidth: 0.5)
        )
    }
}

#Preview("Large") {
    WidgetPreviewLarge()
        .padding()
}
