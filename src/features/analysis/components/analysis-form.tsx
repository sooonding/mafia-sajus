'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useAnalysisNew } from '../context/analysis-new-context';
import { analysisRequestSchema, type AnalysisRequestInput } from '@/lib/validation/schemas';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { APP_CONFIG, GENDER_LABELS } from '@/constants/app';
import { toast } from '@/hooks/use-toast';

/**
 * 분석 폼 컴포넌트
 */
export function AnalysisForm() {
  const { canSubmit, usageExceeded, submitAnalysis, state } = useAnalysisNew();
  const router = useRouter();

  const form = useForm<AnalysisRequestInput>({
    resolver: zodResolver(analysisRequestSchema),
    defaultValues: {
      birthDate: undefined,
      birthTime: undefined,
      birthTimeUnknown: false,
      isLunar: false,
      gender: undefined,
    },
  });

  const birthTimeUnknown = form.watch('birthTimeUnknown');

  const onSubmit = async (data: AnalysisRequestInput) => {
    try {
      const requestData = {
        birthDate: data.birthDate!.toISOString().split('T')[0],
        birthTime: data.birthTimeUnknown ? undefined : data.birthTime,
        isLunar: data.isLunar,
        gender: data.gender!,
      };

      const analysisId = await submitAnalysis(requestData);

      toast({
        title: '분석 완료',
        description: '사주 분석이 완료되었습니다',
      });

      router.push(APP_CONFIG.routes.analysisDetail(analysisId));
    } catch (error) {
      // 에러는 Context에서 처리됨
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 생년월일 */}
        <FormField
          control={form.control}
          name="birthDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>생년월일 *</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  {...field}
                  value={field.value ? field.value.toISOString().split('T')[0] : ''}
                  onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                  max={new Date().toISOString().split('T')[0]}
                  min="1900-01-01"
                  disabled={usageExceeded}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 출생 시간 */}
        <FormField
          control={form.control}
          name="birthTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>출생 시간</FormLabel>
              <FormControl>
                <Input
                  type="time"
                  {...field}
                  value={field.value || ''}
                  disabled={birthTimeUnknown || usageExceeded}
                  placeholder="HH:MM"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 모름 체크박스 */}
        <FormField
          control={form.control}
          name="birthTimeUnknown"
          render={({ field }) => (
            <FormItem className="flex items-center space-x-2">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    if (checked) {
                      form.setValue('birthTime', undefined);
                    }
                  }}
                  disabled={usageExceeded}
                />
              </FormControl>
              <FormLabel className="!mt-0">출생 시간을 모릅니다</FormLabel>
            </FormItem>
          )}
        />

        {/* 양력/음력 */}
        <FormField
          control={form.control}
          name="isLunar"
          render={({ field }) => (
            <FormItem>
              <FormLabel>양력/음력 *</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={(value) => field.onChange(value === 'lunar')}
                  value={field.value ? 'lunar' : 'solar'}
                  disabled={usageExceeded}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="solar" id="solar" />
                    <label htmlFor="solar">양력</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="lunar" id="lunar" />
                    <label htmlFor="lunar">음력</label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 성별 */}
        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>성별 *</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={usageExceeded}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="male" />
                    <label htmlFor="male">{GENDER_LABELS.male}</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="female" />
                    <label htmlFor="female">{GENDER_LABELS.female}</label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 제출 버튼 */}
        <Button
          type="submit"
          className="w-full"
          disabled={!canSubmit || usageExceeded || state.isSubmitting}
          size="lg"
        >
          {state.isSubmitting ? '분석 중...' : usageExceeded ? '사용량 초과' : '분석하기'}
        </Button>

        {/* Pro 업그레이드 버튼 (무료 유저 사용량 초과 시) */}
        {usageExceeded && state.usageInfo?.subscriptionTier === 'free' && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push(APP_CONFIG.routes.subscription)}
          >
            Pro로 업그레이드
          </Button>
        )}
      </form>
    </Form>
  );
}
