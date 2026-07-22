// Declarações para import de assets de imagem (ex: import logo from './logo.png').
// O metro do Expo resolve esses imports para o id do asset (number) em runtime.
declare module '*.png' {
  const content: number;
  export default content;
}

declare module '*.jpg' {
  const content: number;
  export default content;
}

declare module '*.jpeg' {
  const content: number;
  export default content;
}

declare module '*.webp' {
  const content: number;
  export default content;
}
