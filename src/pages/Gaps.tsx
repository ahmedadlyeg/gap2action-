import { Navigate, useParams } from 'react-router-dom';
export function Gaps() {
  const { id } = useParams();
  return <Navigate to={`/events/${id}?tab=gaps`} replace />;
}
