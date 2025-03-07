<script lang="ts">
import { RadioButton, RadioGroup } from '@rancher/components';
import semver from 'semver';
import Vue, { VueConstructor } from 'vue';
import { mapGetters, mapState } from 'vuex';

import RdCheckbox from '@pkg/components/form/RdCheckbox.vue';
import RdFieldset from '@pkg/components/form/RdFieldset.vue';
import TooltipIcon from '@pkg/components/form/TooltipIcon.vue';
import { MountType, Settings, VMType } from '@pkg/config/settings';
import { RecursiveTypes } from '@pkg/utils/typeUtils';
import IncompatiblePreferencesAlert, { CompatiblePrefs } from '~/components/IncompatiblePreferencesAlert.vue';

import type { PropType } from 'vue';

interface VuexBindings {
  macOsVersion: semver.SemVer;
  isArm: boolean;
}

export default (Vue as VueConstructor<Vue & VuexBindings>).extend({
  name:       'preferences-virtual-machine-emulation',
  components: {
    TooltipIcon,
    IncompatiblePreferencesAlert,
    RadioGroup,
    RdFieldset,
    RdCheckbox,
    RadioButton,
  },
  props: {
    preferences: {
      type:     Object as PropType<Settings>,
      required: true,
    },
  },
  computed: {
    ...mapGetters('preferences', ['isPreferenceLocked']),
    ...mapState('transientSettings', ['macOsVersion', 'isArm']),
    options(): { label: string, value: VMType, description: string, experimental: boolean, disabled: boolean,
      compatiblePrefs: CompatiblePrefs | [] }[] {
      const defaultOption = VMType.QEMU;

      return Object.values(VMType)
        .map((x) => {
          return {
            label:           this.t(`virtualMachine.type.options.${ x }.label`),
            value:           x,
            description:     this.t(`virtualMachine.type.options.${ x }.description`, {}, true),
            experimental:    x !== defaultOption, // Mark experimental option
            disabled:        x === VMType.VZ && this.vzDisabled,
            compatiblePrefs: this.getCompatiblePrefs(x),
          };
        });
    },
    groupName(): string {
      return 'vmType';
    },
    vZSelected(): boolean {
      return this.preferences.experimental.virtualMachine.type === VMType.VZ;
    },
    vzDisabled(): boolean {
      return semver.lt(this.macOsVersion.version, '13.0.0') || (this.isArm && semver.lt(this.macOsVersion.version, '13.3.0'));
    },
    rosettaDisabled(): boolean {
      return !this.isArm;
    },
    arch(): string {
      return this.isArm ? 'arm64' : 'x64';
    },
  },
  methods: {
    onChange<P extends keyof RecursiveTypes<Settings>>(property: P, value: RecursiveTypes<Settings>[P]) {
      this.$store.dispatch('preferences/updatePreferencesData', { property, value });
    },
    disabledVmTypeTooltip(disabled: boolean): { content: string } | {} {
      let tooltip = {};

      if (disabled) {
        tooltip = { content: this.t(`prefs.onlyFromVentura_${ this.arch }`) };
      }

      return tooltip;
    },
    getCompatiblePrefs(vmType: VMType): CompatiblePrefs | [] {
      const compatiblePrefs: CompatiblePrefs = [];

      switch (vmType) {
      case VMType.QEMU:
        if (this.preferences.experimental.virtualMachine.mount.type === MountType.VIRTIOFS) {
          compatiblePrefs.push(
            { prefName: MountType.REVERSE_SSHFS, tabName: 'volumes' },
            { prefName: MountType.NINEP, tabName: 'volumes' } );
        }
        break;
      case VMType.VZ:
        if (this.preferences.experimental.virtualMachine.mount.type === MountType.NINEP) {
          compatiblePrefs.push(
            { prefName: MountType.REVERSE_SSHFS, tabName: 'volumes' },
            { prefName: MountType.VIRTIOFS, tabName: 'volumes' } );
        }
        break;
      }

      return compatiblePrefs;
    },
  },
});
</script>

<template>
  <div class="virtual-machine-emulation">
    <div class="row">
      <div class="col span-6">
        <rd-fieldset
          data-test="vmType"
          :legend-text="t('virtualMachine.type.legend')"
          :is-locked="isPreferenceLocked('experimental.virtualMachine.type')"
        >
          <template #default="{ isLocked }">
            <radio-group
              :options="options"
              :name="groupName"
              :disabled="isLocked"
              :class="{ 'locked-radio' : isLocked }"
            >
              <template
                v-for="(option, index) in options"
                #[index]="{ isDisabled }"
              >
                <radio-button
                  :key="groupName+'-'+index"
                  v-tooltip="disabledVmTypeTooltip(option.disabled)"
                  :name="groupName"
                  :value="preferences.experimental.virtualMachine.type"
                  :val="option.value"
                  :disabled="option.disabled || isDisabled"
                  :data-test="option.label"
                  @input="onChange('experimental.virtualMachine.type', $event)"
                >
                  <template #label>
                    {{ option.label }}
                    <tooltip-icon
                      v-if="option.experimental"
                    />
                  </template>
                  <template #description>
                    {{ option.description }}
                    <incompatible-preferences-alert
                      v-if="option.value === preferences.experimental.virtualMachine.type"
                      :compatible-prefs="option.compatiblePrefs"
                      @update:tab="$emit('update:tab', $event)"
                    />
                  </template>
                </radio-button>
              </template>
            </radio-group>
          </template>
        </rd-fieldset>
      </div>
      <div
        v-if="vZSelected && !rosettaDisabled"
        class="col span-6 vz-sub-options"
      >
        <rd-fieldset
          data-test="useRosetta"
          :legend-text="t('virtualMachine.useRosetta.legend')"
        >
          <rd-checkbox
            :label="t('virtualMachine.useRosetta.label')"
            :value="preferences.experimental.virtualMachine.useRosetta"
            :is-locked="isPreferenceLocked('experimental.virtualMachine.useRosetta')"
            @input="onChange('experimental.virtualMachine.useRosetta', $event)"
          />
        </rd-fieldset>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .vz-sub-options {
    border-left: 1px solid var(--border);
    padding-left: 1rem;
    display: flex;
    flex-direction: column;
  }
</style>
