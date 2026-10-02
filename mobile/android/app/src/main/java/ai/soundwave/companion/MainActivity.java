package ai.soundwave.companion;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The Soundwave voices on the phone itself (when the PC is off).
        registerPlugin(EdgeTtsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
