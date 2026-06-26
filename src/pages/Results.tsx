import { Navigate, useParams } from 'react-router-dom';
export function Results() {
  const { id } = useParams();
  return <Navigate to={`/events/${id}?tab=results`} replace />;
}
