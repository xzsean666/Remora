package com.remora.app

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content)) { view, windowInsets ->
      val insets = windowInsets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      view.updatePadding(
        insets.left,
        insets.top,
        insets.right,
        insets.bottom
      )
      windowInsets
    }
  }
}
