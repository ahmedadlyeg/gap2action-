import { Navigate, useParams } from 'react-router-dom';
export function Roadmap() {
  const { id } = useParams();
  return <Navigate to={`/events/${id}?tab=roadmap`} replace />;
}
