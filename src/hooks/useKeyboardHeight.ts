import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Retorna a altura atual do teclado (0 quando fechado).
 * Use para adicionar paddingBottom dinâmico em ScrollViews de formulários,
 * garantindo que o conteúdo possa rolar acima do teclado no Android.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (e) => {
      setHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
