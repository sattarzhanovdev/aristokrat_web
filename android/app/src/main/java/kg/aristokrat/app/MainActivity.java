package kg.aristokrat.app;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Android 16 (API 36) всегда рисует приложение под системными панелями;
        // отступы отдаёт Capacitor SystemBars через CSS-переменные --safe-area-inset-*.
        // Вызывать строго ПОСЛЕ super.onCreate: там BridgeActivity ставит тему без ActionBar,
        // а раннее обращение к окну создаёт его со стартовой темой — и появляется лишняя шапка.
        EdgeToEdge.enable(this);
    }
}
