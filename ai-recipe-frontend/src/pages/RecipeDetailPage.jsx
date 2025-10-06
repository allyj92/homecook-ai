import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function RecipeDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/recipes/${id}`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(res.status);
        setData(await res.json());
      } catch (e) { setErr(e); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <div className="container-xxl py-4">불러오는 중…</div>;
  if (err) return <div className="container-xxl py-4 text-danger">에러: {String(err)}</div>;
  if (!data) return <div className="container-xxl py-4">데이터가 없어요.</div>;

  return (
    <div className="container-xxl py-4">
      <h1 className="h3 fw-bold mb-2">{data.title || `레시피 #${id}`}</h1>
      <div className="text-secondary small mb-3">
        {data.createdAt ? new Date(data.createdAt).toLocaleString() : null}
      </div>
      {data.repImageUrl ? (
        <img src={data.repImageUrl} alt="" className="img-fluid rounded mb-3" />
      ) : null}
      {data.summary ? <p className="mb-3">{data.summary}</p> : null}

      {/* 필요 시 영양/재료/스텝 등 표시 */}
      {data.ingredients_list?.length ? (
        <>
          <h2 className="h5 mt-4">재료</h2>
          <ul>{data.ingredients_list.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </>
      ) : null}

      {data.steps?.length ? (
        <>
          <h2 className="h5 mt-4">조리 순서</h2>
          <ol>{data.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
        </>
      ) : null}
    </div>
  );
}