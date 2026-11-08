// Temporary screen for step 1: proves the database works by listing the default activities.
import { listActivities, listCategories } from '../db/queries';
import { formatPoints } from '../lib/scoring';
import { useLoader } from '../lib/useLoader';
import { AppText, Row, Screen, Section } from '../components/ui';

export default function TodayScreen() {
  const data = useLoader(async () => ({
    categories: await listCategories(),
    activities: await listActivities(),
  }));

  return (
    <Screen padTop>
      <AppText variant="label" muted>
        ARIADNE
      </AppText>
      <AppText variant="title">Activities</AppText>
      {data?.categories.map((category) => (
        <Section key={category.id} title={category.name}>
          {data.activities
            .filter((a) => a.category_id === category.id)
            .map((a) => (
              <Row key={a.id} label={a.name} hint={a.is_quick ? 'Quick action' : undefined}>
                <AppText variant="bodyStrong">{formatPoints(a.points)}</AppText>
              </Row>
            ))}
        </Section>
      ))}
    </Screen>
  );
}
