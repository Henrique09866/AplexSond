import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { SongListItem } from '../components/SongListItem';
import { EmptyState } from '../components/EmptyState';
import { useLibraryStore, usePlayerStore } from '../store';
import { Track } from '../core/entities';
import { COLORS, TYPOGRAPHY, SPACING, SIZES } from '../constants/theme';

type RecentSection = {
  title: string;
  data: Track[];
};

export const RecentsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const tracks = useLibraryStore((s) => s.tracks);
  const markTrackPlayed = useLibraryStore((s) => s.markTrackPlayed);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playQueue = usePlayerStore((s) => s.playQueue);

  const sections = useMemo<RecentSection[]>(() => {
    const recentlyPlayed = tracks
      .filter((track) => !!track.lastPlayedAt)
      .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
      .slice(0, 25);

    const recentlyAdded = [...tracks]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 25);

    return [
      { title: 'TOCADAS RECENTEMENTE', data: recentlyPlayed },
      { title: 'ADICIONADAS RECENTEMENTE', data: recentlyAdded },
    ].filter((section) => section.data.length > 0);
  }, [tracks]);

  const allRecentTracks = useMemo(
    () => sections.flatMap((section) => section.data),
    [sections],
  );

  const handlePlay = useCallback(
    (track: Track) => {
      const queue = allRecentTracks.length ? allRecentTracks : tracks;
      const index = Math.max(0, queue.findIndex((item) => item.id === track.id));
      markTrackPlayed(track.id);
      playQueue(queue, index);
      navigation.navigate('PlayerScene');
    },
    [allRecentTracks, markTrackPlayed, navigation, playQueue, tracks],
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg.base} />

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={({ item }) => (
          <SongListItem
            id={item.id}
            title={item.title}
            artist={item.artist}
            duration={Math.floor(item.duration / 1000)}
            artwork={item.artwork}
            isPlaying={currentTrack?.id === item.id && isPlaying}
            onPress={() => handlePlay(item)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionLabel}>{section.title}</Text>
        )}
        ListHeaderComponent={
          <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
            <View style={styles.headerContent}>
              <Text style={styles.pageTitle}>Recentes</Text>
              <Text style={styles.pageSubtitle}>
                Suas músicas tocadas e adicionadas mais recentemente
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title="Nada recente ainda"
            subtitle="Toque uma música ou importe novas faixas para aparecer aqui"
          />
        }
        contentContainerStyle={[
          styles.list,
          {
            paddingBottom:
              insets.bottom +
              SPACING.tabBarHeight +
              SIZES.miniPlayerHeight +
              SPACING.lg,
          },
        ]}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg.base,
  },
  list: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: SPACING.xl,
  },
  headerContent: {
    flex: 1,
  },
  pageTitle: {
    ...TYPOGRAPHY.h1,
  },
  pageSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  sectionLabel: {
    ...TYPOGRAPHY.overline,
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.bg.base,
  },
});
