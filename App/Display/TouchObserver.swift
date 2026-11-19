import SwiftUI
import UIKit
import UIKit.UIGestureRecognizerSubclass

/// 창 안의 모든 터치를 지켜보고 알려 줍니다. 터치를 가로채거나 늦추지 않습니다.
///
/// SwiftUI의 `simultaneousGesture`는 목록 스크롤과 끌어서 순서 바꾸기를 놓치므로 UIKit 인식기를 씁니다.
struct TouchObserver: UIViewRepresentable {
    let onTouch: () -> Void

    func makeUIView(context: Context) -> HostView {
        let view = HostView()
        view.isUserInteractionEnabled = false
        view.onTouch = onTouch
        return view
    }

    func updateUIView(_ view: HostView, context: Context) {
        view.onTouch = onTouch
    }

    final class HostView: UIView {
        var onTouch: () -> Void = {}
        private lazy var recognizer = Recognizer { [weak self] in self?.onTouch() }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            recognizer.view?.removeGestureRecognizer(recognizer)
            window?.addGestureRecognizer(recognizer)
        }

        override func removeFromSuperview() {
            recognizer.view?.removeGestureRecognizer(recognizer)
            super.removeFromSuperview()
        }
    }

    final class Recognizer: UIGestureRecognizer, UIGestureRecognizerDelegate {
        private let handler: () -> Void

        init(handler: @escaping () -> Void) {
            self.handler = handler
            super.init(target: nil, action: nil)
            cancelsTouchesInView = false
            delaysTouchesBegan = false
            delaysTouchesEnded = false
            delegate = self
        }

        override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
            handler()
            state = .failed
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                               shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
    }
}
