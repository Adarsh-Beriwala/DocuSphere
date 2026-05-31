import { render, screen } from '@testing-library/react';
import App from './App';

test('renders DocuSphere app', () => {
  render(<App />);
  const heading = screen.getByText(/DocuSphere/i);
  expect(heading).toBeInTheDocument();
});
